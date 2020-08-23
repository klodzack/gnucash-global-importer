import { GncElement } from "./GncElement";
import { newId } from "./util";

export interface SplitFromObj {
    reconciledState?: boolean;
    value: number;
    quantity: number;
    accountId: string;
}

export class Split extends GncElement {
    getId() {
        return this.getChildText('split:id', x => !!x.attributes && x.attributes.type === 'guid');
    }

    getReconciledState() {
        return this.getChildText('split:reconciled-state') === 'a';
    }

    getValue() {
        const text = this.getChildText('split:value');
        const match = /^(-?\d+)\/(\d+)$/.exec(text);
        if (!match) throw new Error('Invalid value!');
        const ret = Number(match[1]) / Number(match[2]);
        if (isNaN(ret)) throw new Error('Invalid value!');
        return ret;
    }

    getQuantity() {
        const text = this.getChildText('split:quantity');
        const match = /^(-?\d+)\/(\d+)$/.exec(text);
        if (!match) throw new Error('Invalid value!');
        const ret = Number(match[1]) / Number(match[2]);
        if (isNaN(ret)) throw new Error('Invalid value!');
        return ret;
    }

    getAccountId() {
        return this.getChildText('split:account', e => !!e.attributes && e.attributes.type === 'guid');
    }

    static fromObj(obj: SplitFromObj): Split {
        return new Split({
            type: 'element',
            name: 'trn:split',
            elements: [
                {
                    type: 'element',
                    name: 'split:id',
                    attributes: { type: 'guid' },
                    elements: [{
                        type: 'text',
                        text: newId()
                    }]
                }, {
                    type: 'element',
                    name: 'split:reconciled-state',
                    elements: [{
                        type: 'text',
                        text: (!!obj.reconciledState) ? 'n' : 'y'
                    }]
                }, {
                    type: 'element',
                    name: 'split:value',
                    elements: [{
                        type: 'text',
                        text: `${Math.round(obj.value * 100)}/100`
                    }]
                }, {
                    type: 'element',
                    name: 'split:quantity',
                    elements: [{
                        type: 'text',
                        text: `${Math.round(obj.quantity * 100)}/100`
                    }]
                }, {
                    type: 'element',
                    name: 'split:account',
                    attributes: { type: 'guid' },
                    elements: [{
                        type: 'text',
                        text: obj.accountId
                    }]
                }
            ]
        });
    }
}
