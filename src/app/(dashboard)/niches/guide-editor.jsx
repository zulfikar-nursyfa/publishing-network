"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { cn } from "@/components/ui";
import { bodyHtml } from "@/lib/publishing/content";
import { Formatting } from "../articles/body-editor";

export const GUIDE_MAX_LENGTH = 8000;

/** The article editor's formatting for a writing guide; saves HTML in a hidden field named `name`. */
export function GuideEditor({
  name,
  defaultValue,
  dir,
  labelledBy,
  invalid,
  placeholder,
  maxLength = GUIDE_MAX_LENGTH,
}) {
  const [html, setHtml] = useState(() => bodyHtml(defaultValue));
  const editor = useEditor({
    immediatelyRender: false,
    content: html,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        dir: dir ?? "auto",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        "aria-invalid": invalid ? "true" : "false",
        class: "pn-editor min-h-48 max-h-[32rem] overflow-y-auto px-4 py-3 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: current }) => setHtml(current.isEmpty ? "" : current.getHTML()),
  });
  const over = html.length > maxLength;
  return (
    <div
      className={cn(
        "overflow-clip rounded-lg border border-input bg-card focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        (invalid || over) && "border-destructive",
      )}
    >
      <input type="hidden" name={name} value={html} />
      <div className="flex items-center gap-0.5 overflow-x-auto border-b bg-card/95 px-2 py-1.5">
        <Formatting editor={editor} />
      </div>
      <EditorContent editor={editor} />
      <div
        className={cn(
          "border-t bg-muted/30 px-4 py-1.5 text-end text-xs tabular-nums",
          over ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {html.length.toLocaleString()} / {maxLength.toLocaleString()} characters
      </div>
    </div>
  );
}
