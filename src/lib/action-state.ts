/** Shared result shape for form server actions (shown in a .flash div). */
export type ActionState = { ok: boolean; message: string };

export const emptyActionState: ActionState = { ok: false, message: "" };
