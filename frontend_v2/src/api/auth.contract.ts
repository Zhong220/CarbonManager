export type UserType = "Farmer" | "Consumer" | "None";

export interface LoginResp {
  token: string;
  username: string;
  type: UserType;
}

export interface MeResp {
  username: string;
  type: UserType;
  shops: { id: string; name: string }[];
}

export interface AuthClient {
  login(account: string, password: string): Promise<LoginResp>;
  signup(input: { account: string; password: string; role: UserType; shopName?: string }): Promise<LoginResp>;
  getMe(): Promise<MeResp>;
  logout(): Promise<void>;
}
