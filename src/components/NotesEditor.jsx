import React, { useEffect, useRef, useState } from 'react'

function NotesEditor({ value = '', onCommit, onSave, placeholder, rows = 6, className }) {
  const [text, setText] = useState(value)
  const isFocused = useRef(false)

  useEffect(() => {
    if (!isFocused.current) {
      setText(value || '')
    }
  }, [value])

  const handleBlur = () => {
    isFocused.current = false
    if (onCommit) onCommit(text)
  }

  const handleFocus = () => {
    isFocused.current = true
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      if (onSave) onSave(text)
    }
  }

  return (
    <textarea
      className={className}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
    />
  )
}

export default NotesEditor
