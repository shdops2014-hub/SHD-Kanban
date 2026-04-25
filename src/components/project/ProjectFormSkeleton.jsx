function SkeletonField({ wide }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-3.5 bg-gray-200 rounded w-1/3 mb-1 animate-pulse" />
      <div className={`h-9 bg-gray-100 rounded-lg animate-pulse ${wide ? 'w-full' : 'w-full'}`} />
    </div>
  )
}

function SkeletonTextarea() {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-3.5 bg-gray-200 rounded w-1/4 mb-1 animate-pulse" />
      <div className="h-20 bg-gray-100 rounded-lg animate-pulse w-full" />
    </div>
  )
}

export default function ProjectFormSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left column */}
      <div className="flex flex-col gap-4">
        <SkeletonField />
        <SkeletonField />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonField />
          <SkeletonField />
        </div>
        <SkeletonField />
        <SkeletonField />
        <SkeletonTextarea />
        <SkeletonTextarea />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-4">
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
          <SkeletonField />
          <SkeletonField />
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
