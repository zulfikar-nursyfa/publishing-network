"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { useEditorState } from "@tiptap/react";
import { ImagePlus, Link2, Link2Off, SquarePlay } from "lucide-react";
import { addInlineImage } from "@/app/actions/images";
import { SubmitButton, useActionStateWithNotice } from "@/components/form-controls";
import { Field, buttonClass, cn, inputClass } from "@/components/ui";
import { embedUrl, linkUrl } from "@/lib/body-tools";
import { ImageFields } from "./image-fields";

/** Link, image and embed tools for the body editor. */
export function BodyToolbar({ editor, articleId }) {
  const [tool, setTool] = useState(null);
  const [error, setError] = useState(null);
  const link = useEditorState({ editor, selector: ({ editor: e }) => e?.getAttributes("link").href ?? null });
  const [imageState, imageAction] = useActionStateWithNotice(async (previous, data) => {
    const result = await addInlineImage(articleId, previous, data);
    if (result.marker) addBlock(result.marker);
    return result;
  }, {});

  /** Adds `text` as its own paragraph after the cursor: image lines and embed links must stand alone. */
  function addBlock(text) {
    const { $to } = editor.state.selection;
    const end = $to.depth ? $to.after(1) : $to.pos;
    editor
      .chain()
      .focus()
      .insertContentAt(end, { type: "paragraph", content: [{ type: "text", text }] })
      .run();
    setTool(null);
  }

  function addLink(event) {
    event.preventDefault();
    const href = linkUrl(new FormData(event.currentTarget).get("url"));
    if (!href) return setError("Enter a full link starting with https://");
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !link)
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    else chain.setLink({ href }).run();
    setTool(null);
  }

  function addEmbed(event) {
    event.preventDefault();
    const url = embedUrl(String(new FormData(event.currentTarget).get("url")));
    if (!url) return setError("Paste the link to a YouTube video, an X post or an Instagram post.");
    addBlock(url);
  }

  const open = (name) => {
    setError(null);
    setTool(name);
  };
  if (!editor) return null;

  return (
    <>
      <ToolButton label={link ? "Edit link" : "Link"} active={Boolean(link)} onClick={() => open("link")}>
        <Link2 />
      </ToolButton>
      {link ? (
        <ToolButton
          label="Remove link"
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Link2Off />
        </ToolButton>
      ) : null}
      <ToolButton
        label={articleId ? "Image" : "Save the article first to add images"}
        disabled={!articleId}
        onClick={() => open("image")}
      >
        <ImagePlus />
      </ToolButton>
      <ToolButton label="Embed a YouTube video, X post or Instagram post" onClick={() => open("embed")}>
        <SquarePlay />
      </ToolButton>

      <ToolDialog
        open={tool === "link"}
        onClose={() => setTool(null)}
        editor={editor}
        title={link ? "Edit link" : "Add a link"}
        description="Turns the selected words into a link. Without a selection the address itself is inserted."
      >
        <form onSubmit={addLink} className="space-y-4">
          <Field label="Link address" htmlFor="link-url" error={error}>
            <input
              id="link-url"
              name="url"
              dir="ltr"
              autoFocus
              defaultValue={link ?? ""}
              className={inputClass}
              placeholder="https://…"
            />
          </Field>
          <DialogActions label={link ? "Update link" : "Add link"} />
        </form>
      </ToolDialog>

      <ToolDialog
        open={tool === "embed"}
        onClose={() => setTool(null)}
        editor={editor}
        title="Embed a video or post"
        description="Paste a YouTube, X or Instagram link. It goes on its own line and shows as the video or post on the website."
      >
        <form onSubmit={addEmbed} className="space-y-4">
          <Field label="Link" htmlFor="embed-url" error={error}>
            <input
              id="embed-url"
              name="url"
              dir="ltr"
              autoFocus
              className={inputClass}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>
          <DialogActions label="Embed" />
        </form>
      </ToolDialog>

      {articleId ? (
        <ToolDialog
          open={tool === "image"}
          onClose={() => setTool(null)}
          editor={editor}
          title="Add an image to the body"
          description="Placed after the cursor as an [image:…] line. It is uploaded to WordPress with its caption and credit when the article is published."
        >
          <form action={imageAction} className="space-y-4">
            <Field label="Image" htmlFor="inline-image-file" error={imageState.fieldErrors?.file}>
              <input
                id="inline-image-file"
                name="file"
                type="file"
                required
                accept="image/png,image/jpeg,image/webp"
                className={inputClass}
              />
            </Field>
            <ImageFields errors={imageState.fieldErrors ?? {}} idPrefix="inline-image" />
            <div className="flex justify-end gap-2">
              <Dialog.Close className={buttonClass("secondary")}>Cancel</Dialog.Close>
              <SubmitButton pendingLabel="Uploading…">Add image</SubmitButton>
            </div>
          </form>
        </ToolDialog>
      ) : null}
    </>
  );
}

function ToolDialog({ open, onClose, editor, title, description, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          // Back to the editor, where the selection the tool acted on still is.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.commands.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-2xl data-[state=open]:animate-zoom-in"
        >
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 mb-5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogActions({ label }) {
  return (
    <div className="flex justify-end gap-2">
      <Dialog.Close className={buttonClass("secondary")}>Cancel</Dialog.Close>
      <button type="submit" className={buttonClass("primary")}>
        {label}
      </button>
    </div>
  );
}

export function ToolButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection while clicking the toolbar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:size-8 [&_svg]:size-4",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}
