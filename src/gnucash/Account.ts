import { GncElement } from "./GncElement";
import { getNodeText } from "./util";

export class Account extends GncElement {
    getName(): string {
        return this.getChildText('act:name');
    }

    getId(): string {
        return this.getChildText('act:id', x => !!x.attributes && x.attributes.type === 'guid');
    }

    getType(): string {
        return this.getChildText('act:type');
    }

    getDescription(): string | null {
        const children = this.getChildren('act:description');
        if (!children.length) return null;
        if (children.length > 1) throw new Error('Multiple descriptions?');
        return getNodeText(children[0]);
    }

    getParentId(): string | null {
        const children = this.getChildren('act:parent', x => !!x.attributes && x.attributes.type === 'guid');
        if (!children.length) return null;
        if (children.length > 1) throw new Error('Multiple parents?');
        return getNodeText(children[0]);
    }
}