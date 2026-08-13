
export enum FileStatus {
    Added = "added",
    Modified = "modified",
    Deleted = "deleted"
}

export interface ChangedFile {
    path: string
    status: FileStatus
}


// enums