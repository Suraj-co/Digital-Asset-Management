# ADR 0026 — Dashboard charts use the stored counts

## Status

Accepted. Module 17.

## Problem

The dashboard already counted assets by stage, tasks by status, and time entries by status. A chart that used any other number would be a fake metric.

## Decision

- `/dashboard` draws those same counts as bar charts: asset stage, task status, and time-entry status.
- The numbers beside the charts are the same response fields.
- A zero count is drawn as zero. The chart does not add a stored-file series, because no file is stored.

## Alternatives

- Add a chart library series for “files in Drive”. Rejected. That count does not exist.

## Trade-offs

The charts are fixed width inside a scrolling row so a narrow page does not grow the document.

## Revisit when

A live Drive read can count stored files. That series stays absent until then.
