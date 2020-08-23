import { getNodeText } from './util';

type Element = import('xml-js').Element;

export class GncElement {
    private cachedThings: any = {};

    constructor(private element: Element) { }

    getChildren(name: string, filter?: ((e: Element) => boolean)): Element[] {
        if (!this.element.elements) return [];
        return this.element.elements.filter(e => e.type === 'element' && e.name === name && (!filter || filter(e)));
    }

    getChild(name: string, filter?: ((e: Element) => boolean)): Element {
        const children = this.getChildren(name, filter);
        if (children.length === 0) throw new Error(`Cannot find <${name}>${filter ? ' (with restrictions)' : ''}!`);
        if (children.length > 1) throw new Error(`Found too many <${name}>s${filter ? ' (with restrictions)' : ''}!`);
        return children[0];
    }

    getChildText(name: string, filter?: ((e: Element) => boolean)): string {
        const elm = this.getChild(name, filter);
        return getNodeText(elm);
    }

    getNodes(name: string, filter?: ((e: GncElement) => boolean)): GncElement[] {
        return this.getChildren(name)
            .map(x => new GncElement(x))
            .filter(x => !filter || filter(x));
    }

    getNode(name: string, filter?: ((e: GncElement) => boolean)): GncElement {
        const children = this.getNodes(name, filter);
        if (children.length === 0) throw new Error(`Cannot find <${name}>${filter ? ' (with restrictions)' : ''}!`);
        if (children.length > 1) throw new Error(`Found too many <${name}>s${filter ? ' (with restrictions)' : ''}!`);
        return children[0];
    }

    makeOrReturn<T>(name: string, factory: () => T): T  {
        if (!this.cachedThings[name]) this.cachedThings[name] = factory();
        return this.cachedThings[name];
    }

    _getTypes() {
        const set = new Set<string>();
        for (const elm of this.element.elements || []) {
            if (!elm.name) continue;
            set.add(elm.name);
        }
        return Array.from(set.values());
    }

    getCount(type: string) {
        return Number(this.getChildText('gnc:count-data', e => !!(e.attributes && e.attributes['cd:type'] === type)));
    }
}