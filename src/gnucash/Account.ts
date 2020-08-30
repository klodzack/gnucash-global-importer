import { GncElement } from "./GncElement";
import { getNodeText } from "./util";
import { threadId } from "worker_threads";
import { Book } from "./Book";
import { Slots } from "./Slots";

type Element = import('xml-js').Element;

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

    getSlots(): Slots {
        const slotsRoots = this.getChildren('act:slots');
        if (slotsRoots.length === 0) return {};
        if (slotsRoots.length > 1) throw new Error('Multiple <act:slots>s?');
        const slotsRoot = slotsRoots[0];

        const ret: Slots = {};
        for (const slot of (slotsRoot.elements || []).filter(slot => slot.name === 'slot')) {
            const keyNode = (slot.elements || []).find(e => e.name === 'slot:key');
            if (!keyNode) continue;
            const key = getNodeText(keyNode);

            const valueNode = (slot.elements || []).find(e => e.name === 'slot:value');
            if (!valueNode) continue;
            const value = getNodeText(valueNode);

            ret[key] = value;
        }

        return ret;
    }

    getSlot(name: string): string {
        return this.getSlots()[name];
    }

    setSlot(name: string, value: string) {
        const slotsRoots = this.getChildren('act:slots');
        if (slotsRoots.length > 1) throw new Error('Multiple <act:slots>s?');
        if (slotsRoots.length === 0) {
            this.addChild({ name: 'act:slots', type: 'element' });
        }
        const slotRoot = this.getChildren('act:slots')[0];

        const slotNodes = (slotRoot.elements || []).filter(slot => slot.name === 'slot');
        const goalNode = slotNodes.find(slotNode => {
            const keyNode = (slotNode.elements || []).find(e => e.name === 'slot:key');
            if (!keyNode) return false;
            return getNodeText(keyNode) === name;
        });

        if (goalNode) {

            const maybeValueNode = (goalNode.elements || []).find(e => e.name === 'slot:value');
            if (!maybeValueNode) {
                if (!goalNode.elements) goalNode.elements = [];
                goalNode.elements.push({ name: 'slot:value', type: 'element' });
            }
            const valueNode = (goalNode.elements as Element[]).find(e => e.name === 'slot:value') as Element;
            
            const maybeTextNode = (valueNode.elements || []).find(e => e.type === 'text');
            if (!maybeTextNode) {
                if (!valueNode.elements) valueNode.elements = [];
                valueNode.elements.push({ type: 'text' });
            }
            const textNode = (valueNode.elements as Element[]).find(e => e.type === 'text') as Element;
            textNode.text = value;

        } else {

            if (!slotRoot.elements) slotRoot.elements = [];
            slotRoot.elements.push({
                type: 'element',
                name: 'slot',
                elements: [
                    {
                        type: 'element',
                        name: 'slot:key',
                        elements: [{
                            type: 'text',
                            text: name,
                        }],
                    },
                    {
                        type: 'element',
                        name: 'slot:value',
                        elements: [{
                            type: 'text',
                            text: value,
                        }],
                    },
                ],
            });

        }
    }

    setMintAccountId(id: number) {
        this.setSlot('gncmint:mintaccountid', `${id}`);
    }

    getMintAccountId(): number | null {
        return Number(this.getSlot('gncmint:mintaccountid')) || null;
    }
}