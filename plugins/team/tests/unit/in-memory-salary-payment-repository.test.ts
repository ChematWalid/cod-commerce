import { asOperationContext } from '../../domain/ports/operation-context';
import { describeSalaryPaymentRepositoryContract } from '../contract/salary-payment-repository.contract';
import { InMemorySalaryPaymentRepository } from '../fakes/in-memory-salary-payment-repository';

// The fake the pay tests run on must keep the same rules as the Postgres adapter.
describeSalaryPaymentRepositoryContract('InMemorySalaryPaymentRepository', () =>
  Promise.resolve({ repo: new InMemorySalaryPaymentRepository(), ctx: asOperationContext({}) }),
);
