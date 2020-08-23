import { Element } from "xml-js";
import { v4 as uuidv4 } from 'uuid';

export function getNodeText(elm: Element): string {
    const textNode = elm.elements && elm.elements.find(e => e.type === 'text');
    if (!textNode) return '';
    const text = (textNode as Element).text;
    if (text === undefined) return '';
    return text.toString();
}

export function newId(): string {
    return uuidv4().replace(/-/g, '');
}
