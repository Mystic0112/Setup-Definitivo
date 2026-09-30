#!/usr/bin/env python3
"""PreToolUse guard: bloqueia Write/Edit/MultiEdit cujo conteúdo novo casa um
regex proibido em ~/.claude/rules.jsonl.

Formato de cada linha de rules.jsonl:
  {"id","glob","forbid","message","severity"}  severity = "block" | "warn"

Contrato de negação do Claude Code (PreToolUse): imprime no stdout
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
"permissionDecisionReason":"..."}} e sai 0.

Fail-open: QUALQUER erro (json inválido, arquivo ausente, regex ruim) sai 0 sem
bloquear — o guard nunca trava o harness.
"""
import sys
import os
import json
import re
import fnmatch
from pathlib import Path

RULES_PATH = os.environ.get("RULE_GUARD_RULES") or str(
    Path.home() / ".claude" / "rules.jsonl"
)


def load_rules(path):
    rules = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue  # ponytail: linha ruim é ignorada, não derruba tudo
                if isinstance(r, dict) and r.get("forbid"):
                    rules.append(r)
    except FileNotFoundError:
        pass
    return rules


def new_content(tool_input):
    """Conteúdo novo por ferramenta: Write=content, Edit=new_string, MultiEdit=edits[]."""
    if "content" in tool_input:
        return tool_input.get("content") or ""
    if "new_string" in tool_input:
        return tool_input.get("new_string") or ""
    edits = tool_input.get("edits")
    if isinstance(edits, list):
        return "\n".join(
            e.get("new_string", "") for e in edits if isinstance(e, dict)
        )
    return ""


def glob_matches(glob, path):
    if not glob or glob == "**":
        return True
    name = os.path.basename(path)
    pats = {glob}
    if glob.startswith("**/"):
        pats.add(glob[3:])  # **/*.php também casa o basename *.php em qualquer nível
    return any(fnmatch.fnmatch(path, p) or fnmatch.fnmatch(name, p) for p in pats)


def evaluate(payload, rules):
    """Retorna ('deny', motivo) | ('warn', contexto) | None."""
    tool_input = payload.get("tool_input") or {}
    path = tool_input.get("file_path") or ""
    content = new_content(tool_input)
    if not content:
        return None
    warns = []
    for r in rules:
        if not glob_matches(r.get("glob", ""), path):
            continue
        try:
            if not re.search(r["forbid"], content):
                continue
        except re.error:
            continue  # regex inválido na regra: ignora, fail-open
        if r.get("severity", "block") == "warn":
            warns.append(f"[{r.get('id', '?')}] {r.get('message', '')}")
        else:
            return (
                "deny",
                r.get("message") or f"Regra {r.get('id', '?')} proíbe esse conteúdo.",
            )
    if warns:
        return ("warn", "rule-guard: " + " | ".join(warns))
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # fail-open
    try:
        result = evaluate(payload, load_rules(RULES_PATH))
    except Exception:
        sys.exit(0)  # fail-open
    if result is None:
        sys.exit(0)
    kind, msg = result
    if kind == "deny":
        out = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": msg,
            }
        }
    else:
        out = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": msg,
            }
        }
    print(json.dumps(out))
    sys.exit(0)


def _selftest():
    import subprocess
    import tempfile

    rules = [
        {"id": "no-var-dump", "glob": "**/*.php", "forbid": r"var_dump\(", "message": "sem var_dump", "severity": "block"},
        {"id": "no-console", "glob": "**/*.vue", "forbid": r"console\.log\(", "message": "sem console.log", "severity": "warn"},
    ]
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
        for r in rules:
            f.write(json.dumps(r) + "\n")
        rules_file = f.name

    def run(payload):
        env = dict(os.environ, RULE_GUARD_RULES=rules_file)
        p = subprocess.run(
            [sys.executable, __file__],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            env=env,
        )
        out = json.loads(p.stdout) if p.stdout.strip() else {}
        return p.returncode, out

    rc, out = run({"tool_name": "Write", "tool_input": {"file_path": "/x/app.php", "content": "<?php var_dump($x);"}})
    assert rc == 0 and out.get("hookSpecificOutput", {}).get("permissionDecision") == "deny", ("1 viol php", rc, out)

    rc, out = run({"tool_name": "Write", "tool_input": {"file_path": "/x/app.php", "content": "<?php echo 1;"}})
    assert rc == 0 and out == {}, ("2 clean php", rc, out)

    rc, out = run({"tool_name": "Write", "tool_input": {"file_path": "/x/app.js", "content": "var_dump(1)"}})
    assert rc == 0 and out == {}, ("3 glob nao casa", rc, out)

    rc, out = run({"tool_name": "Edit", "tool_input": {"file_path": "/x/c.vue", "new_string": "console.log(1)"}})
    hso = out.get("hookSpecificOutput", {})
    assert rc == 0 and "permissionDecision" not in hso and "additionalContext" in hso, ("4 warn", rc, out)

    env = dict(os.environ, RULE_GUARD_RULES=rules_file)
    p = subprocess.run([sys.executable, __file__], input="}{ not json", capture_output=True, text=True, env=env)
    assert p.returncode == 0 and p.stdout.strip() == "", ("5 garbage fail-open", p.returncode, p.stdout)

    rc, out = run({"tool_name": "MultiEdit", "tool_input": {"file_path": "/x/app.php", "edits": [{"new_string": "ok"}, {"new_string": "var_dump($y)"}]}})
    assert out.get("hookSpecificOutput", {}).get("permissionDecision") == "deny", ("6 multiedit", rc, out)

    os.unlink(rules_file)
    print("rule-guard selftest OK (6 checks)")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        main()
