"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Pilcrow, Quote, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/components/ui";
import { bodyHtml, bodyText } from "@/lib/publishing/content";
import { BodyToolbar, ToolButton } from "./body-toolbar";

const WORDS_PER_MINUTE = 230;

/**
 * Rich text editor (TipTap) for the article body. Saves HTML in a hidden "body" field; plain-text
 * bodies from AI drafts open as paragraphs. Image lines ([image:…]) and embed links stay as their
 * own paragraphs, which publishing turns into figures and WordPress into embeds.
 */
export function BodyEditor({ defaultValue, dir, readOnly, articleId, labelledBy, invalid }) {
  const [html, setHtml] = useState(() => bodyHtml(defaultValue));
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    content: html,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false, // No autolink: an embed link must stay plain text on its own line for WordPress to embed it.
          autolink: false,
          defaultProtocol: "https",
          HTMLAttributes: { target: null, rel: null },
        },
      }),
      Placeholder.configure({ placeholder: "Write the article…" }),
    ],
    editorProps: {
      attributes: {
        dir,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        "aria-invalid": invalid ? "true" : "false",
        class: "pn-editor min-h-[26rem] px-4 py-4 outline-none sm:px-6",
      },
    },
    onUpdate: ({ editor: current }) => setHtml(current.isEmpty ? "" : current.getHTML()),
  });
  // Embed links and image lines are not words a reader reads.
  const words =
    bodyText(html)
      .replace(/^(?:https?:\/\/\S+|\[image:[^\]]+\])$/gm, "")
      .match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

  return (
    <div
      className={cn(
        // clip, not hidden: hidden would stop the toolbar sticking while scrolling.
        "overflow-clip rounded-lg border border-input bg-card transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        invalid && "border-destructive",
      )}
    >
      <input type="hidden" name="body" value={html} />
      {readOnly ? null : (
        <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b sm:flex-wrap bg-card/95 px-2 py-1.5 backdrop-blur">
          <Formatting editor={editor} />
          <Divider />
          <BodyToolbar editor={editor} articleId={articleId} />
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground tabular-nums">
        <span>
          {words} {words === 1 ? "word" : "words"} · {Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read
        </span>
        {readOnly ? (
          <span>Read only</span>
        ) : (
          <span className="hidden sm:inline">Ctrl/⌘ + B bold · I italic · Z undo</span>
        )}
      </div>
    </div>
  );
}

export function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

export function Formatting({ editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            paragraph: e.isActive("paragraph"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            undo: e.can().undo(),
            redo: e.can().redo(),
          }
        : {},
  });
  const run = (command) => () => command(editor.chain().focus()).run();
  if (!editor) return null;
  return (
    <>
      <ToolButton label="Paragraph" active={state.paragraph} onClick={run((c) => c.setParagraph())}>
        <Pilcrow />
      </ToolButton>
      <ToolButton label="Heading" active={state.h2} onClick={run((c) => c.toggleHeading({ level: 2 }))}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="Subheading" active={state.h3} onClick={run((c) => c.toggleHeading({ level: 3 }))}>
        <Heading3 />
      </ToolButton>
      <Divider />
      <ToolButton label="Bold" active={state.bold} onClick={run((c) => c.toggleBold())}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={run((c) => c.toggleItalic())}>
        <Italic />
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={state.bullet} onClick={run((c) => c.toggleBulletList())}>
        <List />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={run((c) => c.toggleOrderedList())}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Quote" active={state.quote} onClick={run((c) => c.toggleBlockquote())}>
        <Quote />
      </ToolButton>
      <Divider />
      <ToolButton label="Undo" disabled={!state.undo} onClick={run((c) => c.undo())}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Redo" disabled={!state.redo} onClick={run((c) => c.redo())}>
        <Redo2 />
      </ToolButton>
    </>
  );
}
