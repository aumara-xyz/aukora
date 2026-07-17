// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// Declarations for doorCustody.mjs (the implementation stays plain .mjs so the supervisor script imports it).
export declare const DOOR_TOKEN_ENV: 'AUKORA_DOOR_TOKEN';
export declare const TOKEN_FILE_BASENAME: 'mind-door.token';
export declare const TOKEN_LOG_LAW: string;
export declare function mintDoorToken(): string;
export declare function tokenFilePath(orgDir: string): string;
export declare function writeTokenFile(orgDir: string, token: string): string;
export declare function readTokenFile(orgDir: string): string | null;
export declare function clearTokenFile(orgDir: string): void;
export declare function describeTokenPresence(orgDir: string): { present: boolean; mode0600: boolean };
export declare function readOrganismLock(orgDir: string): string | null;
export declare function readDoorPid(orgDir: string): number | null;
export declare function supervisorHoldsDoor(
  orgDir: string, checkout: string, isAlive?: (pid: number) => boolean, supStateDir?: string | null,
): { held: boolean; pid: number | null };
export declare function assertComposeMayBindDoor(
  orgDir: string, checkout: string, isAlive?: (pid: number) => boolean, supStateDir?: string | null,
): true;
export declare function readSupervisorDoorPid(stateDir: string): number | null;
