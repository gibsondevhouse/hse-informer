import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

/** Split an oversized reading block without shrinking its text or dropping words. */
export function splitLessonBlock(node: ReactNode): ReactNode[] {
  if (
    !isValidElement<{ children?: ReactNode }>(node) ||
    typeof node.type !== 'string'
  )
    return [node];
  const children = Children.toArray(node.props.children);
  if (node.type === 'label') {
    // Keep the radio and its full accessible answer on each continuation page.
    const text = children.at(-1);
    if (!isValidElement<{ children?: ReactNode }>(text)) return [node];
    const parts = Children.toArray(text.props.children);
    const answer = parts.at(-1);
    if (typeof answer !== 'string' || answer.trim().split(/\s+/).length < 2)
      return [node];
    const words = answer.trim().split(/\s+/);
    const middle = Math.ceil(words.length / 2);
    return [words.slice(0, middle), words.slice(middle)].map((half) =>
      cloneElement(
        node,
        {},
        ...children.slice(0, -1),
        cloneElement(text, {}, ...parts.slice(0, -1), ` ${half.join(' ')}`),
      ),
    );
  }
  if (!['div', 'p', 'h1', 'h2', 'span', 'strong'].includes(node.type))
    return [node];
  if (children.length > 1) {
    const middle = Math.ceil(children.length / 2);
    return [children.slice(0, middle), children.slice(middle)].map((half) =>
      cloneElement(node, {}, ...half),
    );
  }
  const child = children[0];
  if (typeof child === 'string') {
    const words = child.trim().split(/\s+/);
    if (words.length < 2) return [node];
    const middle = Math.ceil(words.length / 2);
    return [words.slice(0, middle), words.slice(middle)].map((half) =>
      cloneElement(node, {}, half.join(' ')),
    );
  }
  const parts = splitLessonBlock(child);
  return parts.length > 1
    ? parts.map((part) => cloneElement(node, {}, part))
    : [node];
}

export function refineLessonBlock(node: ReactNode, depth: number): ReactNode[] {
  return depth > 0
    ? splitLessonBlock(node).flatMap((part) =>
        refineLessonBlock(part, depth - 1),
      )
    : [node];
}
