"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  alterarSenhaUsuario,
  atualizarUsuario,
  criarUsuario,
  excluirUsuario,
} from "@/server/usuarios";
import { TAMANHO_MINIMO_SENHA, type Usuario } from "@/lib/types";

interface UsuariosSecaoProps {
  usuarios: Usuario[];
  usuarioAtualId: string;
}

export function UsuariosSecao({ usuarios, usuarioAtualId }: UsuariosSecaoProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            Pessoas que podem entrar no sistema com e-mail e senha.
          </p>
        </div>
        <UsuarioDialog />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => {
              const ehVoce = usuario.id === usuarioAtualId;
              return (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {usuario.nome}
                      {ehVoce && (
                        <Badge variant="secondary" className="text-[10px]">
                          você
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>
                    {usuario.createdAt
                      ? new Date(usuario.createdAt).toLocaleDateString("pt-BR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <UsuarioDialog usuario={usuario} />
                      {!ehVoce && <ExcluirUsuarioBotao usuario={usuario} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface FormState {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
}

function estadoInicial(usuario?: Usuario): FormState {
  return {
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    senha: "",
    confirmarSenha: "",
  };
}

/** Sem `usuario`: cadastra um novo. Com `usuario`: edita (senha em branco = mantém a atual). */
function UsuarioDialog({ usuario }: { usuario?: Usuario }) {
  const editando = !!usuario;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => estadoInicial(usuario));

  function atualizar(patch: Partial<FormState>) {
    setForm((atual) => ({ ...atual, ...patch }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nome = form.nome.trim();
    const email = form.email.trim();
    const trocarSenha = !editando || form.senha !== "";

    if (!nome) return toast.error("Informe o nome.");
    if (!email) return toast.error("Informe o e-mail.");
    if (trocarSenha) {
      if (form.senha.length < TAMANHO_MINIMO_SENHA) {
        return toast.error(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
      }
      if (form.senha !== form.confirmarSenha) {
        return toast.error("As senhas não conferem.");
      }
    }

    startTransition(async () => {
      try {
        if (editando) {
          await atualizarUsuario(usuario.id, { nome, email });
          if (trocarSenha) await alterarSenhaUsuario(usuario.id, form.senha);
          toast.success(trocarSenha ? "Usuário e senha atualizados." : "Usuário atualizado.");
        } else {
          await criarUsuario({ nome, email, senha: form.senha });
          toast.success(`Usuário ${nome} cadastrado. Ele já pode entrar com esse e-mail e senha.`);
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar usuário.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setForm(estadoInicial(usuario));
      }}
    >
      <DialogTrigger
        render={
          editando ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${usuario.nome}`}>
              <PencilIcon />
            </Button>
          ) : (
            <Button type="button" size="sm">
              <PlusIcon /> Novo usuário
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Deixe a senha em branco para manter a atual."
                : "Passe o e-mail e a senha para a pessoa entrar no sistema."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="usuarioNome">Nome</Label>
              <Input
                id="usuarioNome"
                value={form.nome}
                onChange={(e) => atualizar({ nome: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="usuarioEmail">E-mail</Label>
              <Input
                id="usuarioEmail"
                type="email"
                value={form.email}
                onChange={(e) => atualizar({ email: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="usuarioSenha">{editando ? "Nova senha" : "Senha"}</Label>
                <Input
                  id="usuarioSenha"
                  type="password"
                  value={form.senha}
                  onChange={(e) => atualizar({ senha: e.target.value })}
                  autoComplete="new-password"
                  placeholder={`mín. ${TAMANHO_MINIMO_SENHA} caracteres`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="usuarioConfirmarSenha">Confirmar</Label>
                <Input
                  id="usuarioConfirmarSenha"
                  type="password"
                  value={form.confirmarSenha}
                  onChange={(e) => atualizar({ confirmarSenha: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirUsuarioBotao({ usuario }: { usuario: Usuario }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    if (!confirm(`Remover o acesso de ${usuario.nome} (${usuario.email})?`)) return;
    startTransition(async () => {
      try {
        await excluirUsuario(usuario.id);
        toast.success(`Acesso de ${usuario.nome} removido.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover usuário.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Remover ${usuario.nome}`}
      disabled={isPending}
      onClick={handleExcluir}
    >
      <Trash2Icon />
    </Button>
  );
}
