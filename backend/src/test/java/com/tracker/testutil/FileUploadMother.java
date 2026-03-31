package com.tracker.testutil;

import com.tracker.model.entity.FileUpload;

public final class FileUploadMother {

    public static final String DEFAULT_FILENAME = "export.csv";
    public static final String DEFAULT_MIME_TYPE = "text/csv";

    private FileUploadMother() {}

    public static FileUpload csvUpload() {
        FileUpload upload = new FileUpload();
        upload.setFilename(DEFAULT_FILENAME);
        upload.setMimeType(DEFAULT_MIME_TYPE);
        upload.setRowCount(0);
        return upload;
    }
}
