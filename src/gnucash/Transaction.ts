import { GncElement } from "./GncElement";
import { Split } from "./Split";
import { DateTime } from 'luxon';

export class Transaction extends GncElement {
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
}
