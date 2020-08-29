import { Account } from './Account';

export interface Transaction {
    date: import('luxon').DateTime;
    description: string;
    amount: number;
    account: Account;
}
