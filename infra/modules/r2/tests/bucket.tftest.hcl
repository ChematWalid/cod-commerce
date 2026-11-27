# Run: cd infra/modules/r2 && ../../../scripts/ops/tool.sh tofu init && ../../../scripts/ops/tool.sh tofu test

mock_provider "cloudflare" {}

variables {
  account_id    = "0123456789abcdef0123456789abcdef"
  zone_id       = "fedcba9876543210fedcba9876543210"
  bucket_name   = "assets-staging"
  custom_domain = "cdn.staging.example.dz"
}

run "public_assets_bucket_is_served_on_its_custom_domain" {
  command = plan

  assert {
    condition     = cloudflare_r2_custom_domain.assets.domain == "cdn.staging.example.dz" && cloudflare_r2_custom_domain.assets.bucket_name == "assets-staging"
    error_message = "The assets bucket is served on cdn.<base>."
  }
}

run "a_private_or_backup_bucket_is_refused" {
  command = plan

  variables {
    bucket_name = "backups-prod"
  }

  expect_failures = [var.bucket_name]
}
