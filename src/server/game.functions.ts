/**
 * Server functions that own all writes to the rooms / room_seats / games tables.
 *
 * Clients never write directly anymore — they call these functions, which
 * verify the caller's identity and validate game logic before persisting.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SeatTokenHeader = "x-seat-token";
const AuthHeader = "authorization";

/**
 * Resolve the caller's identity from request headers.
 * Returns the authenticated user_id (if a valid Supabase JWT is present)
 * and/or the seat token (sent by guests as x-seat-token).
 */
async function resolveCaller(): Promise<{ userId: string | null; seatToken: string | null }> {
  const seatToken = (getRequestHeader(SeatTokenHeader) || "").trim() || null;
  const authHeader = getRequestHeader(AuthHeader) || "";
  let userId: string | null = null;
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(token);
        userId = data?.user?.id ?? null;
      } catch {
        userId = null;
      }
    }
  }
  return { userId, seatToken };
}

const NicknameSchema = z.string().trim().min(1).max(32);
const RoomCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9-]+$/i, "Invalid room code");
const RoomIdSchema = z.string().uuid();
const BoardIndexSchema = z.number().int().min(0).max(8);

export const createRoomFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; nickname: string }) => ({
    code: RoomCodeSchema.parse(input.code).toUpperCase(),
    nickname: NicknameSchema.parse(input.nickname),
  }))
  .handler(async ({ data }) => {
    const { userId, seatToken } = await resolveCaller();
    if (!userId && !seatToken) {
      throw new Error("Identity required");
    }
    const { data: rows, error } = await supabaseAdmin.rpc("create_room_secure", {
      _code: data.code,
      _user_id: userId ?? (null as unknown as string),
      _seat_token: seatToken ?? (null as unknown as string),
      _nickname: data.nickname,
    });
    if (error) {
      console.error("create_room_secure error:", error);
      throw new Error(error.message || "Failed to create room");
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Failed to create room");
    return { roomId: row.room_id as string, code: row.room_code as string };
  });

export const joinRoomFn = createServerFn({ method: "POST" })
  .inputValidator((input: { roomId: string; nickname: string }) => ({
    roomId: RoomIdSchema.parse(input.roomId),
    nickname: NicknameSchema.parse(input.nickname),
  }))
  .handler(async ({ data }) => {
    const { userId, seatToken } = await resolveCaller();
    if (!userId && !seatToken) {
      throw new Error("Identity required");
    }
    const { error } = await supabaseAdmin.rpc("join_room_secure", {
      _room_id: data.roomId,
      _user_id: userId ?? (null as unknown as string),
      _seat_token: seatToken ?? (null as unknown as string),
      _nickname: data.nickname,
    });
    if (error) {
      console.error("join_room_secure error:", error);
      throw new Error(error.message || "Failed to join room");
    }
    return { ok: true };
  });

export const makeMoveFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      roomId: string;
      expectedMoveCount: number;
      boardIndex: number;
      cellIndex: number;
    }) => ({
      roomId: RoomIdSchema.parse(input.roomId),
      expectedMoveCount: z.number().int().min(0).parse(input.expectedMoveCount),
      boardIndex: BoardIndexSchema.parse(input.boardIndex),
      cellIndex: BoardIndexSchema.parse(input.cellIndex),
    }),
  )
  .handler(async ({ data }) => {
    const { userId, seatToken } = await resolveCaller();
    if (!userId && !seatToken) {
      throw new Error("Identity required");
    }
    const { error } = await supabaseAdmin.rpc("make_move_secure", {
      _room_id: data.roomId,
      _expected_move_count: data.expectedMoveCount,
      _board_index: data.boardIndex,
      _cell_index: data.cellIndex,
      _user_id: userId ?? (null as unknown as string),
      _seat_token: seatToken ?? (null as unknown as string),
    });
    if (error) {
      console.error("make_move_secure error:", error);
      throw new Error(error.message || "Move rejected");
    }
    return { ok: true };
  });

export const resetGameFn = createServerFn({ method: "POST" })
  .inputValidator((input: { roomId: string }) => ({
    roomId: RoomIdSchema.parse(input.roomId),
  }))
  .handler(async ({ data }) => {
    const { userId, seatToken } = await resolveCaller();
    if (!userId && !seatToken) {
      throw new Error("Identity required");
    }
    const { error } = await supabaseAdmin.rpc("reset_game_secure", {
      _room_id: data.roomId,
      _user_id: userId ?? (null as unknown as string),
      _seat_token: seatToken ?? (null as unknown as string),
    });
    if (error) {
      console.error("reset_game_secure error:", error);
      throw new Error(error.message || "Failed to reset game");
    }
    return { ok: true };
  });

/**
 * Returns which seat (X / O) the caller occupies in the given room, if any.
 * Used by the client to know if they're a player or a spectator without
 * exposing the seat tokens.
 */
export const getMySeatFn = createServerFn({ method: "POST" })
  .inputValidator((input: { roomId: string }) => ({
    roomId: RoomIdSchema.parse(input.roomId),
  }))
  .handler(async ({ data }) => {
    const { userId, seatToken } = await resolveCaller();
    if (!userId && !seatToken) {
      return { seat: null as "X" | "O" | null };
    }
    const { data: rows, error } = await supabaseAdmin
      .from("room_seats")
      .select("seat,user_id,token")
      .eq("room_id", data.roomId);
    if (error) {
      console.error("getMySeat error:", error);
      return { seat: null as "X" | "O" | null };
    }
    for (const row of rows ?? []) {
      if (userId && row.user_id === userId) return { seat: row.seat as "X" | "O" };
      if (seatToken && row.token === seatToken) return { seat: row.seat as "X" | "O" };
    }
    return { seat: null as "X" | "O" | null };
  });
