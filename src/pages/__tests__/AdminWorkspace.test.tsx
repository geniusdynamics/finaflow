// ABOUTME: Verifies admin directory routing, pagination and failure presentation through rendered output.
// ABOUTME: Uses fixture query responses without connecting to the production database or sending messages.
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ error: null as null | { message: string }, calls: [] as Array<{name:string;input:unknown;enabled:boolean}> }));
vi.mock("@/components/Layout", () => ({ Layout: ({children}:{children:ReactNode}) => children }));
vi.mock("@/pages/Admin", () => ({AdminReports:({section}:{section:string})=><p>Report {section}</p>}));
vi.mock("@/providers/trpc", () => {
  const query=(name:string)=>({useQuery:(input:unknown,options:{enabled:boolean})=>{state.calls.push({name,input,enabled:options.enabled});return {data:{data:[],total:0,limit:25,offset:0},isLoading:false,error:state.error,refetch:vi.fn()};}});
  return {trpc:{admin:{listRenewalRequests:{useQuery:()=>({data:{data:[],total:0},isLoading:false,error:null})},listAccounts:query("accounts"),listUsers:query("users"),listAuditEvents:query("audit")}}};
});
import AdminWorkspace from "@/components/admin/AdminWorkspace";
const render=(url="/admin")=>renderToStaticMarkup(<MemoryRouter initialEntries={[url]}><AdminWorkspace/></MemoryRouter>);
beforeEach(()=>{state.error=null;state.calls=[];});
describe("Admin workspace",()=>{
  it("opens the accounts directory and only enables its query",()=>{const html=render();expect(html).toContain("Search customers");expect(state.calls.filter(c=>c.enabled).map(c=>c.name)).toEqual(["accounts"]);expect(html).toContain("No matching records");});
  it("restores URL filters and page offset",()=>{render("/admin?section=accounts&search=Acme&plan=pro&access=held&page=2");expect(state.calls.find(c=>c.name==="accounts")?.input).toEqual({search:"Acme",plan:"pro",access:"held",limit:25,offset:50});});
  it("presents failed requests as errors with retry rather than empty results",()=>{state.error={message:"Directory unavailable"};const html=render();expect(html).toContain("Directory unavailable");expect(html).toContain("Retry");expect(html).not.toContain("No matching records");});
  it("enables the users directory when selected in the URL",()=>{render("/admin?section=users");expect(state.calls.filter(c=>c.enabled).map(c=>c.name)).toEqual(["users"]);});
});
