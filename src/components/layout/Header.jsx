import Button from '../ui/Button'

export default function Header({ onNewProject }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-shd-brown rounded-lg flex items-center justify-center text-white font-bold text-sm">
          S
        </div>
        <div>
          <h1 className="font-bold text-shd-dark text-lg leading-none">SHD Projects</h1>
          <p className="text-xs text-gray-400">Sarah's Home Design, LLC</p>
        </div>
      </div>
      <Button onClick={onNewProject}>+ New Project</Button>
    </header>
  )
}
