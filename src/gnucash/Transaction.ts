import { GncElement } from './GncElement';
import { GncSlottableElement } from "./GncSlottableElement";
import { Split, SplitFromObj } from "./Split";
import { DateTime } from 'luxon';
import { newId } from "./util";

export interface TransactionFromObject {
    datePosted: DateTime;
    description: string;
    splits: SplitFromObj[];
}

export class Transaction extends GncSlottableElement {
    getId(): string {
        return this.getChildText('trn:id', x => !!x.attributes && x.attributes.type === 'guid');
    }

    getDatePosted(): DateTime {
        return DateTime.fromSQL(
            this.getNode('trn:date-posted')
                .getChildText('ts:date')
        );
    }

    getDateEntered(): DateTime {
        return DateTime.fromSQL(
            this.getNode('trn:date-entered')
                .getChildText('ts:date')
        );
    }

    getDescription(): string {
        return this.getChildText('trn:description');
    }
    
    getSplits(): Split[] {
        return this.makeOrReturn('splits', () => new GncElement(this.getChild('trn:splits')).getChildren('trn:split').map(x => new Split(x)));
    }

    static fromObj(obj: TransactionFromObject): Transaction {
        return new Transaction({
            type: 'element',
            name: 'gnc:transaction',
            attributes: { version: '2.0.0' },
            elements: [
                {
                    type: 'element',
                    name: 'trn:id',
                    attributes: { type: 'guid' },
                    elements: [{
                        type: 'text',
                        text: newId()
                    }]
                }, {
                    type: 'element',
                    name: 'trn:currency',
                    elements: [
                        {
                            type: 'element',
                            name: 'cmdty:space',
                            elements: [{
                                type: 'text',
                                text: 'CURRENCY'
                            }]
                        }, {
                            type: 'element',
                            name: 'cmdty:id',
                            elements: [{
                                type: 'text',
                                text: 'USD'
                            }]
                        }
                    ]
                }, {
                    type: 'element',
                    name: 'trn:date-posted',
                    elements: [{
                        type: 'element',
                        name: 'ts:date',
                        elements: [{
                            type: 'text',
                            text: obj.datePosted.toSQL() as string
                        }]
                    }]
                }, {
                    type: 'element',
                    name: 'trn:date-entered',
                    elements: [{
                        type: 'element',
                        name: 'ts:date',
                        elements: [{
                            type: 'text',
                            text: DateTime.utc().toSQL() as string
                        }]
                    }]
                }, {
                    type: 'element',
                    name: 'trn:description',
                    elements: [{
                        type: 'text',
                        text: obj.description
                    }]
                }, {
                    type: 'element',
                    name: 'trn:slots',
                    elements: [{
                        type: 'element',
                        name: 'slot',
                        elements: [
                            {
                                type: 'element',
                                name: 'slot:key',
                                elements: [{
                                    type: 'text',
                                    text: 'date-posted'
                                }]
                            }, {
                                type: 'element',
                                name: 'slot:value',
                                attributes: { type: 'gdate' },
                                elements: [{
                                    type: 'element',
                                    name: 'gdate',
                                    elements: [{
                                        type: 'text',
                                        text: obj.datePosted.toISODate() as string
                                    }]
                                }]
                            }
                        ]
                    }]
                }, {
                    type: 'element',
                    name: 'trn:splits',
                    elements: obj.splits.map(s => Split.fromObj(s).getXML())
                }
            ]
        });
    }
}
