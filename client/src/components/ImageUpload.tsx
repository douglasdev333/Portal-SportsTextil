import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Loader2, GripVertical, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  eventId?: string;
  images: { id?: string; url: string; ordem?: number }[];
  onImagesChange: (images: { id?: string; url: string; ordem?: number }[]) => void;
  maxImages?: number;
  aspectRatio?: "square" | "portrait" | "landscape";
  label?: string;
  description?: string;
}

export function ImageUpload({
  eventId,
  images = [],
  onImagesChange,
  maxImages = 10,
  aspectRatio = "portrait",
  label = "Imagens",
  description = "Arraste ou clique para adicionar imagens"
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();
  
  const safeImages = images || [];

  const aspectRatioClass = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video"
  }[aspectRatio];

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - safeImages.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Você pode adicionar no máximo ${maxImages} imagens`,
        variant: "destructive"
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Arquivo inválido",
          description: "Apenas imagens são permitidas",
          variant: "destructive"
        });
        return;
      }
    }

    if (eventId) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        filesToUpload.forEach(file => formData.append("images", file));

        const response = await fetch(`/api/admin/uploads/banners/${eventId}`, {
          method: "POST",
          credentials: "include",
          body: formData
        });

        if (!response.ok) {
          throw new Error("Erro ao fazer upload");
        }

        const result = await response.json();
        if (result.success) {
          const newImages = result.data.map((banner: any) => ({
            id: banner.id,
            url: banner.imagemUrl,
            ordem: banner.ordem
          }));
          onImagesChange([...safeImages, ...newImages]);
          toast({
            title: "Upload concluido",
            description: `${newImages.length} imagem(ns) adicionada(s)`
          });
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Erro no upload",
          description: "Não foi possível fazer upload das imagens",
          variant: "destructive"
        });
      } finally {
        setIsUploading(false);
      }
    } else {
      const newImages = await Promise.all(
        filesToUpload.map(async (file) => {
          return new Promise<{ url: string; ordem: number }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                url: e.target?.result as string,
                ordem: safeImages.length
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );
      onImagesChange([...safeImages, ...newImages]);
    }
  }, [eventId, safeImages, maxImages, onImagesChange, toast]);

  const handleRemove = useCallback(async (index: number) => {
    const image = safeImages[index];
    
    if (eventId && image.id) {
      try {
        const response = await fetch(`/api/admin/uploads/banner/${image.id}`, {
          method: "DELETE",
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Erro ao remover");
        }
      } catch (error) {
        console.error("Remove error:", error);
        toast({
          title: "Erro ao remover",
          description: "Não foi possível remover a imagem",
          variant: "destructive"
        });
        return;
      }
    }

    const newImages = safeImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  }, [eventId, safeImages, onImagesChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {safeImages.length}/{maxImages}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {safeImages.map((image, index) => (
          <Card
            key={image.id || index}
            className={`relative overflow-hidden group ${aspectRatioClass}`}
            data-testid={`card-image-${index}`}
          >
            <img
              src={image.url}
              alt={`Imagem ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                size="icon"
                variant="destructive"
                onClick={() => handleRemove(index)}
                data-testid={`button-remove-image-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {index + 1}
            </div>
          </Card>
        ))}

        {safeImages.length < maxImages && (
          <label
            className={`
              relative flex flex-col items-center justify-center 
              border-2 border-dashed rounded-lg cursor-pointer
              transition-colors ${aspectRatioClass}
              ${dragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"}
              ${isUploading ? "pointer-events-none opacity-50" : ""}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-testid="input-image-upload"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={isUploading}
            />
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground text-center px-2">
                  Clique ou arraste
                </span>
              </>
            )}
          </label>
        )}
      </div>

      {aspectRatio === "portrait" && (
        <p className="text-xs text-muted-foreground">
          Formato recomendado: 4:5 (formato de post do Instagram)
        </p>
      )}
    </div>
  );
}

interface SingleImageUploadProps {
  eventId?: string;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  uploadType: "route" | "banner";
  label?: string;
  description?: string;
  aspectRatio?: "square" | "portrait" | "landscape";
}

export function SingleImageUpload({
  eventId,
  imageUrl,
  onImageChange,
  uploadType,
  label = "Imagem",
  description = "Clique para adicionar uma imagem",
  aspectRatio = "landscape"
}: SingleImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const aspectRatioClass = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video"
  }[aspectRatio];

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Apenas imagens são permitidas",
        variant: "destructive"
      });
      return;
    }

    if (eventId) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", file);

        const endpoint = uploadType === "route" 
          ? `/api/admin/uploads/route/${eventId}`
          : `/api/admin/uploads/banner/${eventId}`;

        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          body: formData
        });

        if (!response.ok) {
          throw new Error("Erro ao fazer upload");
        }

        const result = await response.json();
        if (result.success) {
          onImageChange(result.data.imagemPercursoUrl || result.data.imagemUrl);
          toast({
            title: "Upload concluido",
            description: "Imagem adicionada com sucesso"
          });
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Erro no upload",
          description: "Não foi possível fazer upload da imagem",
          variant: "destructive"
        });
      } finally {
        setIsUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageChange(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [eventId, uploadType, onImageChange, toast]);

  const handleRemove = useCallback(async () => {
    if (eventId && uploadType === "route") {
      try {
        const response = await fetch(`/api/admin/uploads/route/${eventId}`, {
          method: "DELETE",
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Erro ao remover");
        }
      } catch (error) {
        console.error("Remove error:", error);
        toast({
          title: "Erro ao remover",
          description: "Não foi possível remover a imagem",
          variant: "destructive"
        });
        return;
      }
    }
    onImageChange(null);
  }, [eventId, uploadType, onImageChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {imageUrl ? (
        <Card className={`relative overflow-hidden group ${aspectRatioClass} max-w-md`}>
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleUpload(e.target.files)}
                disabled={isUploading}
              />
              <Button size="sm" variant="secondary" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Trocar
                </span>
              </Button>
            </label>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              data-testid="button-remove-single-image"
            >
              <X className="h-4 w-4 mr-2" />
              Remover
            </Button>
          </div>
        </Card>
      ) : (
        <label
          className={`
            relative flex flex-col items-center justify-center 
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors ${aspectRatioClass} max-w-md
            ${dragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"}
            ${isUploading ? "pointer-events-none opacity-50" : ""}
          `}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          data-testid="input-single-image-upload"
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={isUploading}
          />
          {isUploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <span className="text-sm text-muted-foreground">
                Clique ou arraste uma imagem
              </span>
            </>
          )}
        </label>
      )}
    </div>
  );
}
