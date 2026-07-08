'use client'

import { ChevronDown, Download, FileStack, Folder, FolderOpen, GripVertical, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DragEvent, useMemo, useState } from 'react'

export type DocumentStatus = 'published' | 'draft' | 'disabled'
export const TEACHING_DOCUMENT_FOLDERS = [
  'Lesson Plan',
  'Slide',
  'Homework',
  'Assigment Barem',
  'Sample',
  'Material',
] as const
export type TeachingDocumentFolder = (typeof TEACHING_DOCUMENT_FOLDERS)[number]

export type TeachingDocument = {
  id: number
  title: string
  description: string | null
  file_name: string
  file_size: number
  file_type: string
  subject_name: string
  course_name: string | null
  document_level: 'Basic' | 'Advance' | 'Intensive'
  folder_name?: TeachingDocumentFolder
  source_type?: 'file' | 'material_link'
  material_url?: string | null
  lesson_number: string
  document_status?: DocumentStatus
  created_by_email: string
  created_at: string
}

export const LEVELS = ['Basic', 'Advance', 'Intensive'] as const
export const SUBJECT_FOLDERS = ['Coding', 'Robotic', 'Art', 'Trải nghiệm', 'E-Book'] as const
export const LEVELED_SUBJECTS = new Set(['Coding', 'Robotic', 'Art'])
export const COURSE_OPTIONS: Record<string, string[]> = {
  Coding: ['Scratch', 'Gamemaker', 'Python', 'Web', 'Computer Science'],
  Robotic: ['Robotic 4+', 'Robotic Vex Go N1', 'Robotic Vex Go N2', 'Robotic Vex IQ N3'],
  Art: [
    'Digital Art Foundation',
    'Visual Thinking',
    'Game Art',
    'Character & Mascot',
    'Graphic Design',
    'Visual Communication',
    'Multimedia Video',
  ],
  'Trải nghiệm': ['KIND - lớp 4+'],
  'E-Book': ['E-Book'],
}

function formatFileSize(bytes: number) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function normalizeSubject(subject: string) {
  if (subject === 'Robotics') return 'Robotic'
  if (subject === 'Digital Art' || subject === 'Game Design' || subject === 'Khoa học máy tính') return 'Coding'
  return subject
}

function normalizeCourse(document: TeachingDocument) {
  return document.course_name || 'Chưa phân môn'
}

function documentExtension(fileName: string) {
  return fileName.split('.').pop()?.toUpperCase() || 'FILE'
}

function isMaterialLink(document: TeachingDocument) {
  return document.source_type === 'material_link'
}

function buildFolderTree(documents: TeachingDocument[], subjects: readonly string[]) {
  const tree = new Map<string, Map<string, Map<string, Map<string, TeachingDocument[]>>>>()

  subjects.forEach((subject) => {
    const courseMap = new Map<string, Map<string, Map<string, TeachingDocument[]>>>()
    ;(COURSE_OPTIONS[subject] || ['Tất cả tài liệu']).forEach((course) => {
      const levelMap = new Map<string, Map<string, TeachingDocument[]>>()
      const levels = LEVELED_SUBJECTS.has(subject) ? LEVELS : ['Tất cả tài liệu']
      levels.forEach((level) => {
        const folderMap = new Map<string, TeachingDocument[]>()
        TEACHING_DOCUMENT_FOLDERS.forEach((folder) => folderMap.set(folder, []))
        levelMap.set(level, folderMap)
      })
      courseMap.set(course, levelMap)
    })
    tree.set(subject, courseMap)
  })

  documents.forEach((document) => {
    const subject = normalizeSubject(document.subject_name)
    if (!subjects.includes(subject)) return
    const course = normalizeCourse(document)
    if (!tree.has(subject)) tree.set(subject, new Map())
    const courseMap = tree.get(subject)!
    if (!courseMap.has(course)) courseMap.set(course, new Map())
    const levelMap = courseMap.get(course)!
    const level = LEVELED_SUBJECTS.has(subject) ? document.document_level : 'Tất cả tài liệu'
    if (!levelMap.has(level)) levelMap.set(level, new Map())
    const folderMap = levelMap.get(level)!
    const folder = document.folder_name || 'Material'
    if (!folderMap.has(folder)) folderMap.set(folder, [])
    folderMap.get(folder)!.push(document)
  })

  return Array.from(tree.entries()).map(([subject, courseMap]) => ({
    subject,
    total: Array.from(courseMap.values()).reduce(
      (subjectSum, levelMap) =>
        subjectSum +
        Array.from(levelMap.values()).reduce(
          (levelSum, folderMap) =>
            levelSum + Array.from(folderMap.values()).reduce((folderSum, items) => folderSum + items.length, 0),
          0,
        ),
      0,
    ),
    courses: Array.from(courseMap.entries()).map(([course, levelMap]) => ({
      course,
      total: Array.from(levelMap.values()).reduce(
        (levelSum, folderMap) =>
          levelSum + Array.from(folderMap.values()).reduce((folderSum, items) => folderSum + items.length, 0),
        0,
      ),
      levels: Array.from(levelMap.entries()).map(([level, folderMap]) => ({
        level,
        total: Array.from(folderMap.values()).reduce((sum, items) => sum + items.length, 0),
        folders: Array.from(folderMap.entries()).map(([folder, items]) => ({ folder, items })),
      })),
    })),
  }))
}

type TeachingDocumentLibraryProps = {
  documents: TeachingDocument[]
  loading?: boolean
  subjects?: readonly string[]
  emptyText?: string
  viewerBasePath?: string
  allowDocumentMove?: boolean
  onMoveDocument?: (
    document: TeachingDocument,
    folderName: TeachingDocumentFolder,
  ) => Promise<void> | void
}

export function TeachingDocumentLibrary({
  documents,
  loading = false,
  subjects = SUBJECT_FOLDERS,
  emptyText = 'Chưa có tài liệu.',
  viewerBasePath = '/admin/giao-trinh',
  allowDocumentMove = false,
  onMoveDocument,
}: TeachingDocumentLibraryProps) {
  const router = useRouter()
  const [draggedDocumentId, setDraggedDocumentId] = useState<number | null>(null)
  const [activeDropTarget, setActiveDropTarget] = useState('')
  const [movingDocumentId, setMovingDocumentId] = useState<number | null>(null)
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const folderTree = useMemo(() => buildFolderTree(documents, subjects), [documents, subjects])

  const clearDragState = () => {
    setDraggedDocumentId(null)
    setActiveDropTarget('')
  }

  const handleDocumentDragStart = (event: DragEvent<HTMLButtonElement>, document: TeachingDocument) => {
    if (!allowDocumentMove || movingDocumentId !== null) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(document.id))
    setDraggedDocumentId(document.id)
  }

  const handleFolderDrop = async (
    event: DragEvent<HTMLDetailsElement>,
    subject: string,
    course: string,
    level: string,
    folderName: TeachingDocumentFolder,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const documentId = Number(event.dataTransfer.getData('text/plain') || draggedDocumentId)
    const document = documents.find((item) => item.id === documentId)
    clearDragState()
    if (!document || !onMoveDocument) return

    const documentSubject = normalizeSubject(document.subject_name)
    const documentCourse = normalizeCourse(document)
    const documentLevel = LEVELED_SUBJECTS.has(subject) ? document.document_level : 'Tất cả tài liệu'
    if (documentSubject !== subject || documentCourse !== course || documentLevel !== level) return
    if ((document.folder_name || 'Material') === folderName) return

    setMovingDocumentId(document.id)
    try {
      await onMoveDocument(document, folderName)
    } finally {
      setMovingDocumentId(null)
    }
  }

  const handleMaterialDownload = async (document: TeachingDocument) => {
    setDownloadError('')
    setDownloadingDocumentId(document.id)
    try {
      const response = await fetch(`/api/documents/download/${document.id}?mode=json`, { cache: 'no-store' })
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        const data = contentType.includes('application/json') ? await response.json() : null
        const text = data?.error || (!data ? await response.text() : '')
        throw new Error(text || 'Không thể tải Material')
      }

      const responseContentType = response.headers.get('content-type') || ''
      if (responseContentType.includes('application/json')) {
        const data = await response.json()
        if (data?.success === false) throw new Error(data.error || 'Không thể tải Material')
        throw new Error('Phản hồi tải Material không có file đính kèm')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const disposition = response.headers.get('content-disposition') || ''
      const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
      const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
      const fileName = utf8Name
        ? decodeURIComponent(utf8Name)
        : plainName || document.title || 'material'

      const anchor = window.document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      window.document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error: any) {
      setDownloadError(error?.message || 'Không thể tải Material')
    } finally {
      setDownloadingDocumentId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang tải danh sách...
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {downloadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {downloadError}
        </div>
      )}

      {folderTree.map((folder) => (
        <details key={folder.subject} className="group rounded-lg border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <FolderOpen className="h-5 w-5 shrink-0 text-rose-700" />
              <span className="truncate text-sm font-black text-slate-950">{folder.subject}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500">{folder.total}</span>
              <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
            </span>
          </summary>

          <div className="space-y-2 border-t border-slate-200 bg-white p-3">
            {folder.courses.map(({ course, total, levels }) => (
              <details key={`${folder.subject}-${course}`} className="group/course rounded-md border border-slate-100 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 text-slate-600" />
                    <span className="truncate text-sm font-black text-slate-800">{course}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">{total}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open/course:rotate-180" />
                  </span>
                </summary>

                <div className="space-y-2 border-t border-slate-100 p-2">
                  {levels.map(({ level, total: levelTotal, folders }) => (
                    <details
                      key={`${folder.subject}-${course}-${level}`}
                      className="group/level rounded-md border border-slate-200 bg-slate-50"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Folder className="h-4 w-4 shrink-0 text-slate-600" />
                          <span className="truncate text-sm font-black text-slate-800">{level}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-slate-500">
                            {levelTotal}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open/level:rotate-180" />
                        </span>
                      </summary>

                      <div className="grid gap-2 border-t border-slate-100 bg-white p-2 lg:grid-cols-2">
                        {folders.map(({ folder: childFolder, items }) => {
                          const dropTargetKey = `${folder.subject}-${course}-${level}-${childFolder}`
                          const isDropTarget = activeDropTarget === dropTargetKey

                          return (
                          <details
                            key={dropTargetKey}
                            data-folder-drop-target={dropTargetKey}
                            onDragEnter={(event) => {
                              if (!allowDocumentMove || draggedDocumentId === null) return
                              event.preventDefault()
                              setActiveDropTarget(dropTargetKey)
                            }}
                            onDragOver={(event) => {
                              if (!allowDocumentMove || draggedDocumentId === null) return
                              event.preventDefault()
                              event.dataTransfer.dropEffect = 'move'
                            }}
                            onDragLeave={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                setActiveDropTarget('')
                              }
                            }}
                            onDrop={(event) =>
                              void handleFolderDrop(
                                event,
                                folder.subject,
                                course,
                                level,
                                childFolder as TeachingDocumentFolder,
                              )
                            }
                            className={`group/folder rounded-md border bg-slate-50 transition open:lg:col-span-2 ${
                              isDropTarget
                                ? 'border-rose-500 bg-rose-50 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
                                : 'border-slate-100'
                            }`}
                          >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <FileStack className="h-4 w-4 shrink-0 text-rose-600" />
                                <span className="truncate text-sm font-bold text-slate-700">{childFolder}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-slate-500">
                                  {items.length}
                                </span>
                                <ChevronDown className="h-4 w-4 text-slate-400 transition group-open/folder:rotate-180" />
                              </span>
                            </summary>

                            <div className="border-t border-slate-100 bg-white px-3 py-2">
                              {items.length === 0 ? (
                                <p className="px-2 py-4 text-sm text-slate-400">{emptyText}</p>
                              ) : (
                                <div className="space-y-2">
                                  {items.map((document) => (
                                    <button
                                      key={document.id}
                                      type="button"
                                      draggable={allowDocumentMove && movingDocumentId === null}
                                      data-document-id={document.id}
                                      onDragStart={(event) => handleDocumentDragStart(event, document)}
                                      onDragEnd={clearDragState}
                                      onClick={() => {
                                        if (draggedDocumentId === null && movingDocumentId === null) {
                                          if (isMaterialLink(document)) {
                                            void handleMaterialDownload(document)
                                          } else {
                                            router.push(`${viewerBasePath}/${document.id}`)
                                          }
                                        }
                                      }}
                                      className={`flex w-full items-start gap-2.5 rounded-lg border bg-white p-2.5 text-left transition hover:border-rose-200 hover:bg-rose-50 sm:gap-3 sm:p-3 ${
                                        draggedDocumentId === document.id
                                          ? 'cursor-grabbing border-rose-300 opacity-50'
                                          : allowDocumentMove
                                            ? 'cursor-grab border-slate-100'
                                            : 'border-slate-100'
                                      }`}
                                    >
                                      {allowDocumentMove && (
                                        <GripVertical
                                          className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500"
                                          aria-hidden="true"
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <p
                                          className="truncate text-[13px] font-extrabold leading-5 text-slate-900 sm:text-sm"
                                          title={document.title}
                                        >
                                          {document.title}
                                        </p>
                                        {!isMaterialLink(document) && (
                                          <p
                                            className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 sm:text-xs"
                                            title={document.file_name}
                                          >
                                            {document.file_name}
                                          </p>
                                        )}

                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium leading-4 text-slate-500 sm:text-[11px]">
                                          <span className="font-bold text-slate-700">{document.lesson_number}</span>
                                          <span aria-hidden="true" className="text-slate-300">•</span>
                                          {!isMaterialLink(document) && (
                                            <>
                                              <span>{formatFileSize(document.file_size)}</span>
                                              <span aria-hidden="true" className="text-slate-300">•</span>
                                            </>
                                          )}
                                          <span>
                                          {new Date(document.created_at).toLocaleDateString('vi-VN')}
                                          </span>
                                        </div>
                                      </div>

                                      <span
                                        className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-extrabold leading-4 sm:text-[11px] ${
                                          isMaterialLink(document)
                                            ? 'bg-sky-50 text-sky-700'
                                            : 'bg-rose-50 text-rose-700'
                                        }`}
                                      >
                                        {isMaterialLink(document) && (
                                          downloadingDocumentId === document.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <Download className="h-3 w-3" />
                                        )}
                                        {isMaterialLink(document)
                                          ? downloadingDocumentId === document.id
                                            ? 'ĐANG TẢI'
                                            : 'TẢI'
                                          : documentExtension(document.file_name)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </details>
                          )
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
