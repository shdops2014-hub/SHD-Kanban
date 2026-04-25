import { useState } from 'react'
import toast from 'react-hot-toast'
import { deleteImage, uploadImage } from '../../api/sheetsApi'

export default function ImageGallery({ projectId, images, onImagesChange }) {
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try {
        const res = await uploadImage(projectId, file)
        if (res.success) {
          onImagesChange([...images, res.data])
          toast.success(`${file.name} uploaded`)
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleDelete = async (imageId) => {
    try {
      await deleteImage(imageId)
      onImagesChange(images.filter(i => i.imageId !== imageId))
      toast.success('Image removed')
    } catch {
      toast.error('Failed to remove image')
    }
  }

  const thumbUrl = (driveUrl) => {
    const match = driveUrl?.match(/[-\w]{25,}/)
    return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w200` : driveUrl
  }

  const fullUrl = (driveUrl) => {
    const match = driveUrl?.match(/[-\w]{25,}/)
    return match ? `https://drive.google.com/uc?export=view&id=${match[0]}` : driveUrl
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-shd-dark">
          Images {images.length > 0 && <span className="text-gray-400 font-normal">({images.length})</span>}
        </h3>
        <label className="cursor-pointer text-xs text-shd-brown hover:underline font-medium">
          {uploading ? 'Uploading...' : '+ Upload'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {images.length === 0 ? (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-shd-brown transition-colors text-gray-400 text-sm">
          <span className="text-3xl mb-2">🖼</span>
          <span>Click to upload project images</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.imageId} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img
                src={thumbUrl(img.driveUrl)}
                alt={img.fileName}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightbox(fullUrl(img.driveUrl))}
              />
              <button
                onClick={() => handleDelete(img.imageId)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Preview" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
