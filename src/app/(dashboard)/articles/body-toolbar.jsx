"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { ImagePlus, Link2, SquarePlay } from "lucide-react";
import { addInlineImage } from "@/app/actions/images";
import { SubmitButton, useActionStateWithNotice } from "@/components/form-controls";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { asBlock, embedUrl, linkUrl } from "@/lib/body-tools";
import { ImageFields } from "./image-fields";

/** Link, image and embed tools that write into the Body textarea at the cursor or selection. */
export function BodyToolbar({ bodyRef, articleId }) {
  const [tool, setTool] = useState(null);
  const [error, setError] = useState(null);
  const [imageState, imageAction] = useActionStateWithNotice(async (previous, data) => {
    const result = await addInlineImage(articleId, previous, data);
    if (result.marker) insert(result.marker, true);
    return result;
  }, {});

  /** Replaces the selection with `text`, or adds it as its own paragraph after the selection. */
  function insert(text, block = false) {
    const body = bodyRef.current;
    const { selectionStart: start, selectionEnd: end, value } = body;
    if (block) body.setRangeText(asBlock(value.slice(0, end), text, value.slice(end)), end, end, "end");
    else body.setRangeText(text, start, end, "end");
    setTool(null);
  }

  function addLink(event) {
    event.preventDefault();
    const href = linkUrl(new FormData(event.currentTarget).get("url"));
    if (!href) return setError("Enter a full link starting with https://");
    const body = bodyRef.current;
    const text = body.value.slice(body.selectionStart, body.selectionEnd).trim() || href;
    insert(`<a href="${href}">${text}</a>`);
  }

  function addEmbed(event) {
    event.preventDefault();
    const url = embedUrl(String(new FormData(event.currentTarget).get("url")));
    if (!url) return setError("Paste the link to a YouTube video, an X post or an Instagram post.");
    insert(url, true);
  }

  const open = (name) => {
    setError(null);
    setTool(name);
  };
  const button = (name, Icon, label, disabled, title) => (
    <button
      type="button"
      onClick={() => open(name)}
      disabled={disabled}
      title={title}
      className={buttonClass("secondary", null, "sm")}
    >
      <Icon />
      {label}
    </button>
  );

  return (
    <div className="mb-2 flex flex-wrap gap-1.5" dir="ltr">
      {button("link", Link2, "Link", false, "Select words in the body first to turn them into a link")}
      {button(
        "image",
        ImagePlus,
        "Image",
        !articleId,
        articleId ? "Upload an image into the body at the cursor" : "Save the article first to add images",
      )}
      {button("embed", SquarePlay, "Embed", false, "Embed a YouTube video, X post or Instagram post")}

      <ToolDialog
        open={tool === "link"}
        onClose={() => setTool(null)}
        bodyRef={bodyRef}
        title="Add a link"
        description="Turns the selected words into a link. Without a selection the address itself is inserted."
      >
        <form onSubmit={addLink} className="space-y-4">
          <Field label="Link address" htmlFor="link-url" error={error}>
            <input id="link-url" name="url" dir="ltr" autoFocus className={inputClass} placeholder="https://…" />
          </Field>
          <DialogActions label="Add link" />
        </form>
      </ToolDialog>

      <ToolDialog
        open={tool === "embed"}
        onClose={() => setTool(null)}
        bodyRef={bodyRef}
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
          bodyRef={bodyRef}
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
    </div>
  );
}

function ToolDialog({ open, onClose, bodyRef, title, description, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          // Back to the body, where the selection the tool acted on still is.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            bodyRef.current?.focus();
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
