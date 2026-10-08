// AvatarUpload.tsx
"use client"

import { useState, useRef } from "react";
import { Camera, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Slider } from "@/src/components/ui/slider";
import AvatarEditor from "react-avatar-editor";
import { updateAvatar } from "./actions";
import { toast } from "@/src/hooks/use-toast";
import { globalStore } from '@/src/store/store';
import { useT } from '@/src/components/I18nProvider';

interface User {
  name?: string;
  email?: string;
  image?: string;
}

export default function AvatarUpload({ user }: { user: User }) {

  const setAvatar = globalStore((state) => state.setAvatar);
  const t = useT();

  const [image, setImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentImage, setCurrentImage] = useState(user.image || null); // State to manage the current image
  const editorRef = useRef<AvatarEditor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target?.result as string);
      reader.readAsDataURL(file);
      setScale(1);
      setIsOpen(true);
    }
    // Let the same file be picked again later.
    e.target.value = '';
  };

  const handleSave = async () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      // JPEG keeps the stored image small (it lives in the user's database record).
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      setSaving(true);
      try {
        await updateAvatar(dataUrl);
        toast({
          title: t('avatar.updated'),
          description: t('avatar.updatedDesc'),
        });
        setCurrentImage(dataUrl); // Update the current image state
        setAvatar(dataUrl)
        setIsOpen(false);
      } catch (error) {
        toast({
          title: t('common.error'),
          description: t('avatar.failed'),
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    }
  };

  const pickFile = () => fileRef.current?.click();

  return (
    <div className="flex items-center gap-5">
      {/* The photo itself opens the picker too; the camera badge says so. */}
      <button type="button" onClick={pickFile} aria-label={t('avatar.change')} className="group/avatar pressable relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4 focus-visible:ring-offset-black">
        <Avatar className="h-20 w-20 ring-1 ring-white/10 sm:h-24 sm:w-24">
          <AvatarImage src={currentImage ?? undefined} alt={user.name} className="object-cover" />
          <AvatarFallback className="bg-white/[0.08] font-display text-3xl font-bold text-white">{user.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <span aria-hidden className="absolute inset-0 rounded-full bg-black/0 transition-colors duration-200 group-hover/avatar:bg-black/30" />
        <span aria-hidden className="absolute -bottom-0.5 -end-0.5 grid h-8 w-8 place-items-center rounded-full bg-white text-black shadow-[0_4px_14px_rgb(0_0_0/0.5)] ring-[3px] ring-black">
          <Camera className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </button>
      <div className="min-w-0">
        {user.name && <p className="truncate text-[17px] font-semibold text-white">{user.name}</p>}
        {user.email && <p dir="ltr" className="truncate text-start text-[13px] text-white/50 rtl:text-end">{user.email}</p>}
        <Button type="button" variant="secondary" size="sm" onClick={pickFile} className="mt-3">
          {t('avatar.change')}
        </Button>
      </div>
      <input
        ref={fileRef}
        id="avatar-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Dialog open={isOpen} onOpenChange={(open) => !saving && setIsOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">{t('avatar.edit')}</DialogTitle>
            <DialogDescription>
              {t('avatar.editDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-5">
            {image && (
              <div className="w-full max-w-[300px] overflow-hidden rounded-[20px] bg-black ring-1 ring-white/10 [&>canvas]:!h-auto [&>canvas]:!w-full">
                <AvatarEditor
                  ref={editorRef}
                  image={image}
                  width={250}
                  height={250}
                  border={50}
                  borderRadius={125}
                  color={[0, 0, 0, 0.6]}
                  scale={scale}
                />
              </div>
            )}
            <div className="flex w-full max-w-[300px] items-center gap-3">
              <ZoomOut aria-hidden className="h-4 w-4 shrink-0 text-white/50" />
              <Slider
                value={[scale]}
                min={1}
                max={2}
                step={0.01}
                onValueChange={([value]) => setScale(value)}
                aria-label={t('avatar.edit')}
              />
              <ZoomIn aria-hidden className="h-4 w-4 shrink-0 text-white/50" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setIsOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>{t('avatar.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
