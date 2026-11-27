import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ANSIBLE = resolve(__dirname, '../../../infra/ansible');

type Task = Record<string, unknown> & { name?: string };
type Play = { name: string; force_handlers?: boolean; roles?: Array<{ role: string }>; post_tasks?: Task[] };

const read = (path: string): string => readFileSync(join(ANSIBLE, path), 'utf8');
const tasksOf = (path: string): Task[] => parse(read(path)) as Task[];
const isTrackedByGit = (path: string): boolean => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', path], { cwd: ANSIBLE, stdio: 'ignore' });
    return true;
  } catch {
    // git exits non-zero for an untracked path: that is the answer, not an error.
    return false;
  }
};
const isIgnoredByGit = (path: string): boolean => {
  try {
    execFileSync('git', ['check-ignore', '--no-index', '--quiet', path], { cwd: ANSIBLE, stdio: 'ignore' });
    return true;
  } catch {
    // git check-ignore exits 1 when the path is not ignored.
    return false;
  }
};
const indexOfTask = (tasks: Task[], name: string): number => {
  const index = tasks.findIndex((task) => task.name === name);
  expect(index, `task "${name}"`).toBeGreaterThanOrEqual(0);
  return index;
};

describe('infra/ansible server baseline', () => {
  const plays = parse(read('site.yml')) as Play[];
  const roleOrder = plays.flatMap((play) => (play.roles ?? []).map(({ role }) => role));

  it('proves a login as the operator before sshd drops root and password logins', () => {
    const operatorPlay = plays.findIndex((play) => play.roles?.some(({ role }) => role === 'users'));
    const sshPlay = plays.findIndex((play) => play.roles?.some(({ role }) => role === 'ssh'));
    const login = plays[operatorPlay]?.post_tasks?.find((task) => 'ansible.builtin.ping' in task);

    expect(operatorPlay).toBeGreaterThanOrEqual(0);
    expect(sshPlay).toBeGreaterThan(operatorPlay);
    expect(login?.['vars']).toEqual({ ansible_user: '{{ operator_user }}' });
    expect(plays[operatorPlay]?.post_tasks?.some((task) => task['ansible.builtin.meta'] === 'reset_connection')).toBe(
      true,
    );
  });

  it('runs notified handlers even when a later role fails, so a rerun cannot skip them', () => {
    const config = read('ansible.cfg');
    const rolePlays = plays.filter((play) => (play.roles ?? []).length > 0);

    expect(config).toMatch(/^\[defaults\][^[]*^force_handlers = True$/m);
    expect(rolePlays.every((play) => play.force_handlers === true)).toBe(true);
  });

  it('tests and restarts sshd at the end of the ssh role, before any other role can fail', () => {
    const tasks = tasksOf('roles/ssh/tasks/main.yml');

    expect(tasks.at(-1)?.['ansible.builtin.meta']).toBe('flush_handlers');
  });

  it('formats and enables the swap file from its current state, not from a one-shot handler', () => {
    const tasks = tasksOf('roles/swap/tasks/main.yml');
    const format = tasks[indexOfTask(tasks, 'Format the swap file')];
    const enable = tasks[indexOfTask(tasks, 'Turn the swap on')];
    const signature = tasks[indexOfTask(tasks, 'Read the swap file signature')];
    const active = tasks[indexOfTask(tasks, 'List the active swap')];

    expect(tasks.some((task) => 'notify' in task)).toBe(false);
    expect(String(signature?.['ansible.builtin.command'])).toMatch(/^blkid -o value -s TYPE /);
    expect(String(active?.['ansible.builtin.command'])).toBe('swapon --show=NAME --noheadings');
    expect(format?.['when']).toContain("swap_signature.stdout != 'swap'");
    expect(enable?.['when']).toContain('swap_file not in swap_active.stdout_lines');
    expect(indexOfTask(tasks, 'Format the swap file')).toBeLessThan(indexOfTask(tasks, 'Turn the swap on'));
  });

  it('installs Docker before the firewall, so DOCKER-USER exists when the edge chain is built', () => {
    expect(roleOrder.indexOf('docker')).toBeLessThan(roleOrder.indexOf('firewall'));
    expect(roleOrder.indexOf('firewall')).toBeLessThan(roleOrder.indexOf('data_tier'));
  });

  it('validates the sshd settings with sshd -t before any restart', () => {
    const [install] = tasksOf('roles/ssh/tasks/main.yml').filter((task) => 'ansible.builtin.template' in task);
    const handlers = tasksOf('roles/ssh/handlers/main.yml').map((task) => task.name);
    const config = read('roles/ssh/templates/00-cod-hardening.conf.j2');

    expect((install?.['ansible.builtin.template'] as { validate: string }).validate).toBe('/usr/sbin/sshd -t -f %s');
    expect(handlers.indexOf('Check the whole sshd configuration')).toBeLessThan(handlers.indexOf('Restart sshd'));
    expect(config).toMatch(/^PermitRootLogin no$/m);
    expect(config).toMatch(/^PasswordAuthentication no$/m);
    expect(config).toMatch(/^AllowUsers \{\{ operator_user \}\}$/m);
  });

  it('allows SSH before ufw denies incoming traffic and is enabled', () => {
    const tasks = tasksOf('roles/firewall/tasks/ufw.yml');

    expect(indexOfTask(tasks, 'Allow SSH before anything is denied')).toBeLessThan(
      indexOfTask(tasks, 'Deny other incoming traffic and enable ufw'),
    );
  });

  it('opens the web ports to the edge ranges only, in ufw and in DOCKER-USER', () => {
    const ufw = tasksOf('roles/firewall/tasks/ufw.yml');
    const allow = ufw[indexOfTask(ufw, 'Allow the web ports from the edge ranges only')];
    const chain = read('roles/firewall/templates/cod-edge-firewall.sh.j2');

    expect(allow?.['loop']).toBe('{{ firewall_edge_ranges }}');
    expect(chain).toContain('-I DOCKER-USER 1 -j COD-EDGE-NEXT');
    expect(chain).toContain('-s "$cidr" -p tcp -m conntrack --ctorigdstport "$port" -j RETURN');
    expect(chain).toContain('-A COD-EDGE-NEXT -j DROP');
    expect(chain).toMatch(/no IPv4 range in .*rules left unchanged/);
  });

  it('falls back to pinned Cloudflare ranges that hold only CIDRs', () => {
    const v4 = read('roles/firewall/files/cloudflare-ips-v4.txt').trim().split('\n');
    const v6 = read('roles/firewall/files/cloudflare-ips-v6.txt').trim().split('\n');

    expect(v4.length).toBeGreaterThanOrEqual(10);
    expect(v4.every((line) => /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(line))).toBe(true);
    expect(v6.every((line) => /^[0-9a-f:]+\/\d{1,3}$/.test(line))).toBe(true);
  });

  it('pins and holds every Docker package', () => {
    const defaults = parse(read('roles/docker/defaults/main.yml')) as { docker_packages: string[] };
    const tasks = tasksOf('roles/docker/tasks/main.yml');

    expect(defaults.docker_packages.every((pkg) => /^[a-z.-]+=\d[\w.:~-]+$/.test(pkg))).toBe(true);
    expect(tasks.some((task) => 'ansible.builtin.dpkg_selections' in task)).toBe(true);
  });

  it('never prints the data-tier secrets and keeps the vault out of git', () => {
    const tasks = tasksOf('roles/data_tier/tasks/main.yml');
    const envTask = tasks[indexOfTask(tasks, 'Write the data tier environment from the vault')];
    const vaultExample = parse(read('group_vars/staging/vault.yml.example')) as Record<string, string>;

    expect(envTask).toMatchObject({ no_log: true, diff: false });
    expect(read('.gitignore')).toMatch(/^group_vars\/\*\/vault\.yml$/m);
    expect(read('.gitignore')).toMatch(/^inventory\/staging\.yml$/m);
    expect(Object.values(vaultExample).every((value) => value === 'CHANGE_ME')).toBe(true);
    expect(isIgnoredByGit('group_vars/staging/vault.yml')).toBe(true);
    expect(isTrackedByGit('group_vars/staging/vault.yml')).toBe(false);
  });
});
