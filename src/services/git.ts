// Wrappers typés autour de l'intégration git native (git2).
import { invoke } from "@tauri-apps/api/core";

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitCommit {
  id: string;
  summary: string;
  author: string;
}

export interface GitDiff {
  old: string;
  new: string;
}

export function gitRepoRoot(path: string): Promise<string | null> {
  return invoke("git_repo_root", { path });
}

export function gitStatus(path: string): Promise<GitFileStatus[]> {
  return invoke("git_status", { path });
}

export function gitCurrentBranch(path: string): Promise<string> {
  return invoke("git_current_branch", { path });
}

export function gitAheadBehind(path: string): Promise<[number, number]> {
  return invoke("git_ahead_behind", { path });
}

export function gitBranches(path: string): Promise<string[]> {
  return invoke("git_branches", { path });
}

export function gitLog(path: string, limit: number): Promise<GitCommit[]> {
  return invoke("git_log", { path, limit });
}

export function gitStage(path: string, paths: string[]): Promise<void> {
  return invoke("git_stage", { path, paths });
}

export function gitUnstage(path: string, paths: string[]): Promise<void> {
  return invoke("git_unstage", { path, paths });
}

export function gitCommit(path: string, message: string): Promise<string> {
  return invoke("git_commit", { path, message });
}

export function gitCheckoutBranch(path: string, name: string): Promise<void> {
  return invoke("git_checkout_branch", { path, name });
}

export function gitDiff(path: string, file: string): Promise<GitDiff> {
  return invoke("git_diff_file", { path, file });
}
