import { Zap, GitBranch, Variable } from 'lucide-react';

// Simple markdown renderer with tool/state highlighting
export function renderPromptMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const elements: React.ReactNode[] = [];
  let keyIndex = 0;

  // Split by lines first for block-level elements
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    // Process each line
    let processedLine: React.ReactNode[] = [];

    // Process inline elements
    const processInline = (content: string): React.ReactNode[] => {
      const inlineElements: React.ReactNode[] = [];
      let remaining = content;
      let inlineKey = 0;

      while (remaining.length > 0) {
        // Check for tool:[tool_name] pattern
        const toolMatch = remaining.match(/tool:(\w+)/);
        // Check for state:state_name pattern
        const stateMatch = remaining.match(/state:(\w+)/);
        // Check for **bold** pattern
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Check for *italic* pattern (but not if it's part of **)
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
        // Check for `code` pattern
        const codeMatch = remaining.match(/`(.+?)`/);
        // Check for {{variable}} pattern
        const varMatch = remaining.match(/\{\{(\w+)\}\}/);

        // Find the earliest match
        const matches = [
          { match: toolMatch, type: 'tool' },
          { match: stateMatch, type: 'state' },
          { match: boldMatch, type: 'bold' },
          { match: italicMatch, type: 'italic' },
          { match: codeMatch, type: 'code' },
          { match: varMatch, type: 'var' },
        ].filter(m => m.match !== null);

        if (matches.length === 0) {
          // No more matches, add remaining text
          if (remaining) {
            inlineElements.push(<span key={`inline-${lineIdx}-${inlineKey++}`}>{remaining}</span>);
          }
          break;
        }

        // Find earliest match
        const earliest = matches.reduce((prev, curr) =>
          (curr.match!.index! < prev.match!.index!) ? curr : prev
        );

        const matchIndex = earliest.match!.index!;

        // Add text before match
        if (matchIndex > 0) {
          inlineElements.push(
            <span key={`inline-${lineIdx}-${inlineKey++}`}>
              {remaining.substring(0, matchIndex)}
            </span>
          );
        }

        // Add styled match
        const matchText = earliest.match![1];
        const fullMatch = earliest.match![0];

        switch (earliest.type) {
          case 'tool':
            inlineElements.push(
              <span
                key={`inline-${lineIdx}-${inlineKey++}`}
                className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-yellow-200 text-yellow-900 rounded text-[9px] font-semibold border border-yellow-400"
              >
                <Zap className="h-2 w-2" />
                {matchText}
              </span>
            );
            break;
          case 'state':
            inlineElements.push(
              <span
                key={`inline-${lineIdx}-${inlineKey++}`}
                className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-blue-200 text-blue-900 rounded text-[9px] font-semibold border border-blue-400"
              >
                <GitBranch className="h-2 w-2" />
                {matchText}
              </span>
            );
            break;
          case 'bold':
            inlineElements.push(
              <strong key={`inline-${lineIdx}-${inlineKey++}`} className="font-bold">
                {matchText}
              </strong>
            );
            break;
          case 'italic':
            inlineElements.push(
              <em key={`inline-${lineIdx}-${inlineKey++}`} className="italic">
                {matchText}
              </em>
            );
            break;
          case 'code':
            inlineElements.push(
              <code
                key={`inline-${lineIdx}-${inlineKey++}`}
                className="px-1 py-0.5 bg-gray-200 text-gray-800 rounded text-[9px] font-mono"
              >
                {matchText}
              </code>
            );
            break;
          case 'var':
            inlineElements.push(
              <span
                key={`inline-${lineIdx}-${inlineKey++}`}
                className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-purple-200 text-purple-900 rounded text-[9px] font-semibold border border-purple-400"
              >
                <Variable className="h-2 w-2" />
                {matchText}
              </span>
            );
            break;
        }

        remaining = remaining.substring(matchIndex + fullMatch.length);
      }

      return inlineElements;
    };

    // Check for headers
    if (line.startsWith('### ')) {
      processedLine = [
        <span key={`h3-${lineIdx}`} className="font-bold text-sm text-foreground">
          {processInline(line.substring(4))}
        </span>
      ];
    } else if (line.startsWith('## ')) {
      processedLine = [
        <span key={`h2-${lineIdx}`} className="font-bold text-sm text-foreground">
          {processInline(line.substring(3))}
        </span>
      ];
    } else if (line.startsWith('# ')) {
      processedLine = [
        <span key={`h1-${lineIdx}`} className="font-bold text-base text-foreground">
          {processInline(line.substring(2))}
        </span>
      ];
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // List item
      processedLine = [
        <span key={`li-${lineIdx}`} className="flex items-start gap-1.5 pl-2">
          <span className="text-muted-foreground">•</span>
          <span>{processInline(line.substring(2))}</span>
        </span>
      ];
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list
      const numMatch = line.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        processedLine = [
          <span key={`ol-${lineIdx}`} className="flex items-start gap-1.5 pl-2">
            <span className="text-muted-foreground min-w-[1rem]">{numMatch[1]}.</span>
            <span>{processInline(numMatch[2])}</span>
          </span>
        ];
      }
    } else {
      processedLine = processInline(line);
    }

    elements.push(
      <div key={`line-${keyIndex++}`} className={line.trim() === '' ? 'h-2' : ''}>
        {processedLine}
      </div>
    );
  });

  return elements;
}
