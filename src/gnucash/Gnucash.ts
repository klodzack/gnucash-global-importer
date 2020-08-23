import * as fs from 'fs-extra';
import { xml2js, Element } from 'xml-js';
import { GncElement } from './GncElement';
import { Book } from './Book';

export class Gnucash extends GncElement {
    root: Element;

    static async fromFile(fname: string) {
        return new Gnucash((await fs.readFile(fname)).toString());
    }

    constructor(xml: string) {
        const root = xml2js(xml) as Element;
        const elm = (root.elements && root.elements.find(x => x.type === 'element' && x.name === 'gnc-v2')) as Element;
        if (!elm) throw new Error('Cannot find <gnv-v2>');

        super(elm);
        this.root = root;
    }

    getBook(): Book {
        return this.makeOrReturn('book', () => new Book(this.getChild('gnc:book')));
    }
}