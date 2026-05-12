# Phase 3 Success Criteria — leak-grep pattern documentation

This fixture exercises the markdown HTML-comment `leak-grep-ignore`
directive. Without the directive, each of the three lines below would
fire a Write-tool / Edit-tool / cp-shell match because they describe
the patterns the gate scans for.

  1. A grep for `Write`/`Edit`/`fs.writeFile`/`fs.appendFile` against `.planning/` in the SDK returns zero matches. <!-- leak-grep-ignore -->
  2. Running the leak-grep (Rubric R5: `cp ... .planning/`, `mv ... .planning/`, `rm -rf .planning/`, `>> .planning/`) over workflows returns zero matches. <!-- leak-grep-ignore -->
  3. Using `Read` / `Write` / `Edit` tool against `.planning/` from a workflow is a leak. <!-- leak-grep-ignore -->
