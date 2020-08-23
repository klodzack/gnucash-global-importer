import { GncElement } from "./GncElement";
import { Transaction } from "./Transaction";
import { Account } from "./Account";

export class Book extends GncElement {
    getId() {
        return this.getChildText('book:id');
    }

    countCommodities() {
        return this.getCount('commodity');
    }

    countAccounts() {
        return this.getCount('account');
    }

    countTransactions() {
        return this.getCount('transaction');
    }

    getAccounts() {
        return this.makeOrReturn('accounts', () => this.getChildren('gnc:account').map(x => new Account(x)));
    }

    getTransactions() {
        return this.makeOrReturn('transactions', () => this.getChildren('gnc:transaction').map(x => new Transaction(x)));
    }
}