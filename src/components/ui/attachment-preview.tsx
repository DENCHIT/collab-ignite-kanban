import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { Download, Eye, FileText, Image, File } from 'lucide-react'
import { IdeaCommentAttachment } from '@/types/idea'

interface AttachmentPreviewProps {
  attachment: IdeaCommentAttachment
  showThumbnail?: boolean
}

export function AttachmentPreview({ attachment, showThumbnail = false }: AttachmentPreviewProps) {
  const [showModal, setShowModal] = useState(false)

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    if (type.includes('text') || type.includes('document')) return <FileText className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = attachment.url
    link.download = attachment.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isImage = attachment.type.startsWith('image/')
  const canPreview = isImage || attachment.type.includes('text')

  if (showThumbnail && isImage) {
    return (
      <>
        <div 
          className="relative w-16 h-16 bg-muted rounded cursor-pointer overflow-hidden group"
          onClick={() => setShowModal(true)}
        >
          <img 
            src={attachment.url} 
            alt={attachment.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getFileIcon(attachment.type)}
                {attachment.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img 
                src={attachment.url} 
                alt={attachment.name}
                className="w-full max-h-[70vh] object-contain rounded"
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <div 
        className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => canPreview ? setShowModal(true) : handleDownload()}
      >
        {getFileIcon(attachment.type)}
        <span className="flex-1 truncate">{attachment.name}</span>
        <span className="text-muted-foreground">
          {(attachment.size / 1024 / 1024).toFixed(1)}MB
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleDownload()
          }}
          className="h-6 w-6 p-0"
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>
      
      {canPreview && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getFileIcon(attachment.type)}
                {attachment.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isImage ? (
                <img 
                  src={attachment.url} 
                  alt={attachment.name}
                  className="w-full max-h-[70vh] object-contain rounded"
                />
              ) : (
                <div className="p-4 bg-muted rounded">
                  <p className="text-sm">Preview not available for this file type.</p>
                  <p className="text-xs text-muted-foreground mt-1">Click download to view the file.</p>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{(attachment.size / 1024 / 1024).toFixed(2)} MB • {attachment.type}</span>
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}