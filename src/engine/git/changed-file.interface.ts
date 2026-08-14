import type { FileStatus } from "./file-status.js";

export interface ChangedFile {
    path: string;
    status: FileStatus;
}