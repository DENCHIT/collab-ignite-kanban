import { useRef, useState } from 'react'
import { Button } from './button'
import { Paperclip, X, FileText, Image, File } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UploadedFile {
  file: File
  id: string
  preview?: string
}

interface FileUploadProps {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSize?: number // in MB
  accept?: string
  className?: string
}

export function FileUpload({ 
  files, 
  onFilesChange, 
  maxFiles = 5, 
  maxSize = 10,
  accept = "*/*",
  className 
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const newFiles: UploadedFile[] = []
    
    Array.from(selectedFiles).forEach((file) => {
      if (files.length + newFiles.length >= maxFiles) return
      if (file.size > maxSize * 1024 * 1024) return

      const id = crypto.randomUUID()
      const uploadedFile: UploadedFile = { file, id }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          uploadedFile.preview = e.target?.result as string
          onFilesChange([...files, ...newFiles.filter(f => f.id !== id), uploadedFile])
        }
        reader.readAsDataURL(file)
      }

      newFiles.push(uploadedFile)
    })

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles])
    }
  }

  const removeFile = (id: string) => {
    onFilesChange(files.filter(f => f.id !== id))
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    if (type.includes('text') || type.includes('document')) return <FileText className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= maxFiles}
        >
          <Paperclip className="h-4 w-4 mr-1" />
          Attach files
        </Button>
        <span className="text-xs text-muted-foreground">
          {files.length}/{maxFiles} files, max {maxSize}MB each
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
              {getFileIcon(file.file.type)}
              <span className="flex-1 truncate">{file.file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.file.size / 1024 / 1024).toFixed(1)}MB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}