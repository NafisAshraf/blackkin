"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, GripVertical, Trash2, ToggleRight, ToggleLeft } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";

export function CarouselEditor() {
  const items = useQuery(api.landingPage.adminGetCarouselItems);
  const r2Upload = useUploadFile(api.r2);

  const addItem = useMutation(api.landingPage.addCarouselItem);
  const updateText = useMutation(api.landingPage.updateCarouselItemText);
  const updateUrl = useMutation(api.landingPage.updateCarouselItemUrl);
  const updateImage = useMutation(api.landingPage.updateCarouselImage);
  const toggleItem = useMutation(api.landingPage.toggleCarouselItem);
  const deleteItem = useMutation(api.landingPage.deleteCarouselItem);
  const reorderItems = useMutation(api.landingPage.reorderCarouselItems);

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [uploadingId, setUploadingId] = useState<Id<"landingPageCarouselItems"> | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !text.trim()) return;

    setIsAdding(true);
    try {
      const storageId = await r2Upload(file);
      await addItem({ storageId, text: text.trim(), url: url.trim() || undefined });
      toast.success("Carousel item added");
      setFile(null);
      setText("");
      setUrl("");
      (document.getElementById("carousel-image-upload") as HTMLInputElement).value = "";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateImage = async (id: Id<"landingPageCarouselItems">, newFile: File) => {
    setUploadingId(id);
    try {
      const storageId = await r2Upload(newFile);
      await updateImage({ id, storageId });
      toast.success("Image updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update image");
    } finally {
      setUploadingId(null);
    }
  };

  const handleUpdateText = async (id: Id<"landingPageCarouselItems">, newText: string) => {
    try {
      await updateText({ id, text: newText });
    } catch (err) {
      toast.error("Failed to update text");
    }
  };
  
  const handleUpdateUrl = async (id: Id<"landingPageCarouselItems">, newUrl: string) => {
    try {
      await updateUrl({ id, url: newUrl });
    } catch (err) {
      toast.error("Failed to update URL");
    }
  };

  if (items === undefined) {
    return <div className="py-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Loading carousel...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 bg-muted/20 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Add New Item</h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="carousel-image-upload">Image</Label>
            <Input 
              id="carousel-image-upload" 
              type="file" 
              accept="image/*" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required 
            />
          </div>
          <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="carousel-text">Text</Label>
            <Input 
              id="carousel-text" 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder="e.g. Dynamic Stretch"
              required 
            />
          </div>
          <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="carousel-url">URL (Optional)</Label>
            <Input 
              id="carousel-url" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="e.g. /products/new-arrival"
            />
          </div>
          <Button type="submit" disabled={isAdding || items.length >= 10 || !file || !text.trim()}>
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Item
          </Button>
        </form>
        {items.length >= 10 && (
          <p className="text-xs text-red-500">Maximum of 10 items reached.</p>
        )}
      </div>

      {items.length > 0 && (
        <div className="border border-border divide-y">
          <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between">
            <span>Current Items ({items.length}/10)</span>
            <span>Drag to Reorder</span>
          </div>
          <SortableList
            items={items}
            onReorder={async (reordered) => {
              await reorderItems({ items: reordered.map(r => ({ id: r.id as Id<"landingPageCarouselItems">, sortOrder: r.sortOrder })) });
            }}
            renderItem={(item, dragHandle) => (
              <div className="flex items-center gap-4 px-3 py-3 bg-background">
                {dragHandle}
                <div className="relative w-16 h-16 shrink-0 bg-muted overflow-hidden group">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}
                  <label className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    {uploadingId === item._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span className="text-[9px] uppercase mt-1">Change</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) handleUpdateImage(item._id, e.target.files[0]);
                    }} />
                  </label>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <Input 
                    value={item.text} 
                    onChange={(e) => handleUpdateText(item._id, e.target.value)} 
                    className="h-8 text-sm"
                    placeholder="Text"
                  />
                  <Input 
                    value={item.url || ""} 
                    onChange={(e) => handleUpdateUrl(item._id, e.target.value)} 
                    className="h-8 text-[10px] text-muted-foreground"
                    placeholder="Redirect URL (optional)"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={item.isActive ? "default" : "secondary"} className="text-[10px] hidden md:inline-flex">
                    {item.isActive ? "Active" : "Hidden"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleItem({ id: item._id })}
                    title={item.isActive ? "Hide" : "Show"}
                  >
                    {item.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Delete this carousel item?")) deleteItem({ id: item._id });
                    }}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
