// AvatarUpload.tsx
"use client"

import { useState, useRef, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { Slider } from "@/src/components/ui/slider";
import AvatarEditor from "react-avatar-editor";
import { updateAvatar } from "./actions";
import { toast } from "@/src/hooks/use-toast";
import { globalStore } from '@/src/store/store';

interface User {
  name?: string;
  email?: string;
  image?: string;
}

export default function AvatarUpload({ user }: { user: User }) {

  const setAvatar = globalStore((state) => state.setAvatar);

  const [image, setImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(user.image || null); // State to manage the current image
  const editorRef = useRef<AvatarEditor | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target?.result as string);
      reader.readAsDataURL(file);
      setIsOpen(true);
    }
  };

  const handleSave = async () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const dataUrl = canvas.toDataURL();

      try {
        await updateAvatar(dataUrl);
        toast({
          title: "Avatar updated",
          description: "Your avatar has been successfully updated.",
        });
        setCurrentImage(dataUrl); // Update the current image state
        setAvatar(dataUrl)
        setIsOpen(false);
      } catch (error) {
        toast({
          title: "Error",
          description: "There was a problem updating your avatar.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <Avatar className="w-24 h-24">
        <AvatarImage src={currentImage} alt={user.name} /> {/* Use currentImage state */}
        <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <Button variant="outline" onClick={() => document.getElementById('avatar-upload')?.click()}>
        Change Avatar
      </Button>
      <input
        id="avatar-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Avatar</DialogTitle>
            <DialogDescription>
              Adjust your avatar image. You can zoom, move, and crop the image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {image && (
              <AvatarEditor
                ref={editorRef}
                image={image}
                width={250}
                height={250}
                border={50}
                borderRadius={125}
                color={[255, 255, 255, 0.6]}
                scale={scale}
              />
            )}
            <div className="w-full max-w-xs">
              <Slider
                value={[scale]}
                min={1}
                max={2}
                step={0.01}
                onValueChange={([value]) => setScale(value)}
              />
            </div>
            <Button onClick={handleSave}>Save Avatar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}