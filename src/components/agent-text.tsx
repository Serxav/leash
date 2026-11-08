import { parseAgentText, type Inline } from "@/lib/agent-text";

/**
 * The agent's summary with its bold text and lists, never as HTML: every
 * piece is model text that React escapes (D-042).
 */
export function AgentText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parseAgentText(text).map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Pieces pieces={line} />
              </span>
            ))}
          </p>
        ) : block.ordered ? (
          <ol key={index} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Pieces pieces={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Pieces pieces={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function Pieces({ pieces }: { pieces: Inline[] }) {
  return pieces.map((piece, index) =>
    piece.strong ? <strong key={index}>{piece.text}</strong> : <span key={index}>{piece.text}</span>,
  );
}
