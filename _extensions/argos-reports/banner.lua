-- banner.lua — Argos classification banner + portion mark injector
-- Runs across html, typst, and revealjs via common.filters.
local BANNER = "UNCLASSIFIED//FOR TRAINING USE ONLY"

function Pandoc(doc)
  local fmt = FORMAT or ""
  local top, bottom

  if fmt:match("html") or fmt:match("revealjs") then
    top = pandoc.RawBlock("html",
      '<div class="argos-banner">' .. BANNER .. '</div>')
    bottom = pandoc.RawBlock("html",
      '<div class="argos-banner">' .. BANNER .. '</div>')
  elseif fmt:match("typst") then
    local typst_safe = BANNER:gsub("//", "\\/\\/")
    local typst_banner = '#align(center, text(weight: "bold", fill: rgb("#a8b8e0"), "' .. typst_safe .. '"))'
    top = pandoc.RawBlock("typst", typst_banner)
    bottom = pandoc.RawBlock("typst", typst_banner)
  else
    top = pandoc.RawBlock("tex",
      '\\begin{center}\\textbf{' .. BANNER .. '}\\end{center}')
    bottom = pandoc.RawBlock("tex",
      '\\begin{center}\\textbf{' .. BANNER .. '}\\end{center}')
  end

  table.insert(doc.blocks, 1, top)
  table.insert(doc.blocks, bottom)
  return doc
end

function Para(elem)
  if #elem.content == 0 then return elem end
  local first = elem.content[1]
  if first.t == "Str" and first.text:sub(1, 3) == "(U)" then
    return elem
  end
  table.insert(elem.content, 1, pandoc.Str("(U)"))
  table.insert(elem.content, 2, pandoc.Space())
  return elem
end
