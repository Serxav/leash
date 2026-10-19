/**
 * The agent's summary is model text that often uses a little Markdown
 * (`**bold**`, lists, headings). Showing it raw prints the marks; rendering
 * it as HTML would trust model text. This reads only that small subset into
 * plain pieces that React renders as escaped text (D-042).
 */

export type Inline = { text: string; strong: boolean };

export type Block =
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseAgentText(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] | null = null;
  let list: Extract<Block, { kind: "list" }> | null = null;

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;

    if (item) {
      paragraph = null;
      const ordered = numbered !== null;
      if (!list || list.ordered !== ordered) {
        list = { kind: "list", ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(parseInline(item[1]));
      continue;
    }
    list = null;

    if (line.trim() === "") {
      paragraph = null;
      continue;
    }
    const heading = HEADING.exec(line);
    const pieces = heading ? [{ text: stripMarks(heading[1]), strong: true }] : parseInline(line.trim());
    if (!paragraph) {
      paragraph = [];
      blocks.push({ kind: "paragraph", lines: paragraph });
    }
    paragraph.push(pieces);
  }
  return blocks;
}

/**
 * `**bold**` becomes strong text; a lone `**` stays as typed. Code marks
 * (`shop.example`) are dropped and their text kept.
 */
export function parseInline(raw: string): Inline[] {
  const line = raw.replace(/`([^`]+)`/g, "$1");
  const pieces: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(/\*\*(.+?)\*\*/g)) {
    if (match.index > last) pieces.push({ text: line.slice(last, match.index), strong: false });
    pieces.push({ text: match[1], strong: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) pieces.push({ text: line.slice(last), strong: false });
  return pieces;
}

function stripMarks(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}
