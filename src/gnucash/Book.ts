import { GncSlottableElement } from "./GncSlottableElement";
import { Transaction } from "./Transaction";
import { Account } from "./Account";
import { Account as MintAccount, Transaction as MintTransaction } from '../types';
import { prompt } from 'inquirer';

export class Book extends GncSlottableElement {
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

    getAccountById(id: string): Account {
        const ret = this.getAccounts().find(acc => acc.getId() === id);
        if (!ret) throw new Error(`Cannot find account with id ${JSON.stringify(id)}`);
        return ret;
    }

    getAccountForMintAccount(mintAccount: MintAccount): Account {
        const ret = this.getAccounts()
            .find(acc => acc.getMintAccountId() === mintAccount.id);

        if (!ret) throw new Error(`Cannot find account that matches "${mintAccount.provider} - ${mintAccount.name} (${mintAccount.id})`);
        return ret;
    }

    getTransactions() {
        return this.makeOrReturn('transactions', () => this.getChildren('gnc:transaction').map(x => new Transaction(x)));
    }
}