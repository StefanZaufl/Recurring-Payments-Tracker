-- Rename csv_uploads to file_uploads and add mime_type column
ALTER TABLE csv_uploads RENAME TO file_uploads;

ALTER TABLE file_uploads ADD COLUMN mime_type VARCHAR(100);
