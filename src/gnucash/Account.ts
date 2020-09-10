import { GncSlottableElement } from "./GncSlottableElement";
import { getNodeText } from "./util";
import { Book } from "./Book";

type Element = import('xml-js').Element;

export class Account extends GncSlottableElement {
    getName(): string {
        return this.getChildText('act:name');
    }

    getId(): string {
        return this.getChildText('act:id', x => !!x.attributes && x.attributes.type === 'guid');
    }

    getType(): string {
        return this.getChildText('act:type');
    }

    isRoot(): boolean {
        return this.getType() === 'ROOT';
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

    getChoiceName(book: Book): string {
        const parentId = this.getParentId();
        const parent = parentId ? book.getAccountById(parentId) : null;
        if (!parent || parent.isRoot()) return this.getName();
        else return parent.getChoiceName(book) + ' => ' + this.getName();
    }

    setMintAccountId(id: number) {
        this.setSlot('gncmint:mintaccountid', `${id}`);
    }

    getMintAccountId(): number | null {
        return Number(this.getSlot('gncmint:mintaccountid')) || null;
    }
}