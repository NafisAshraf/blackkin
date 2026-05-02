"use client";

import { useMemo } from "react";
import {
  EditorBubble,
  EditorBubbleItem,
  EditorContent,
  EditorRoot,
  JSONContent,
  Placeholder,
  StarterKit,
  TextStyle,
  TiptapLink,
  TiptapUnderline,
  useEditor,
} from "novel";
import { cn } from "@/lib/utils";

const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function ToolbarButton({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 min-w-8 rounded border px-2 text-[11px] font-medium tracking-wide transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BubbleToolbar() {
  const { editor } = useEditor();

  if (!editor) {
    return null;
  }

  return (
    <EditorBubble
      tippyOptions={{ duration: 150 }}
      className="flex items-center gap-1 rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
    >
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          Underline
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Bullets
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbered
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </ToolbarButton>
      </EditorBubbleItem>
      <EditorBubbleItem asChild>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const currentHref = editor.getAttributes("link").href as
              | string
              | undefined;
            const href = window.prompt("Link URL", currentHref ?? "https://");
            if (href === null) {
              return;
            }
            const trimmedHref = href.trim();
            if (!trimmedHref) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href: trimmedHref }).run();
          }}
        >
          Link
        </ToolbarButton>
      </EditorBubbleItem>
    </EditorBubble>
  );
}

export function NovelBlogEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (value: {
    contentHtml: string;
    contentJson: string;
    contentText: string;
  }) => void;
}) {
  const parsedContent = useMemo<JSONContent>(() => {
    try {
      return JSON.parse(initialContent) as JSONContent;
    } catch {
      return EMPTY_DOCUMENT;
    }
  }, [initialContent]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: "Write the story you want search engines and customers to find.",
      }),
      TextStyle,
      TiptapUnderline,
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "underline decoration-foreground/40 underline-offset-4",
        },
      }),
    ],
    [],
  );

  return (
    <EditorRoot>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/30 px-5 py-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Blog Body
        </div>
        <EditorContent
          immediatelyRender={false}
          initialContent={parsedContent}
          extensions={extensions}
          editorProps={{
            attributes: {
              class:
                "blog-editor-surface min-h-[420px] px-5 py-5 text-[15px] leading-7 text-foreground focus:outline-none",
            },
          }}
          onUpdate={({ editor }) => {
            onChange({
              contentHtml: editor.getHTML(),
              contentJson: JSON.stringify(editor.getJSON()),
              contentText: editor.getText(),
            });
          }}
        >
          <BubbleToolbar />
        </EditorContent>
      </div>
    </EditorRoot>
  );
}