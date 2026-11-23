"""Check actual backend imports with simulated Neo and legacy host APIs."""

import importlib
import json
import sys
import tempfile
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class OptionInfo:
    def __init__(self, default, label, *args, **kwargs):
        self.default = default
        self.label = label

    def info(self, text):
        return self

    def needs_restart(self):
        return self


class Options:
    def __init__(self):
        self.data = json.loads((ROOT / "tests/default_options.json").read_text())

    def __getattr__(self, name):
        if name in self.data:
            return self.data[name]
        raise AttributeError(name)

    def add_option(self, name, option):
        self.data.setdefault(name, option.default)


def module(name, **values):
    result = types.ModuleType(name)
    result.__dict__.update(values)
    sys.modules[name] = result
    return result


def run_host(host):
    for name in list(sys.modules):
        if name == "scripts" or name.startswith("scripts."):
            del sys.modules[name]
        if name in {"model_keyword_support", "shared_paths", "tag_frequency_db"}:
            del sys.modules[name]
    with tempfile.TemporaryDirectory() as directory:
        host_root = Path(directory)
        extension = host_root / "extensions" / "test-tac"
        (extension / "tags").mkdir(parents=True)
        (extension / "tags" / "danbooru.csv").write_text("long_hair,0,10,\n")
        embeddings = host_root / "models" / "embeddings"
        embeddings.mkdir(parents=True)
        loras = host_root / "models" / "Lora"
        loras.mkdir(parents=True)
        (loras / "sample.safetensors").write_bytes(b"test")
        calls = []
        if host == "Neo":
            def loader():
                calls.append("neo")
        else:
            def loader(force_reload=False):
                calls.append(force_reload)
        embedding = types.SimpleNamespace(filename=None, shape=2048)
        database = types.SimpleNamespace(
            word_embeddings={"sample_embedding": embedding}, skipped_embeddings={},
            load_textual_inversion_embeddings=loader,
        )
        model = types.SimpleNamespace(text_processing_engine=types.SimpleNamespace(embeddings=database))
        opts = Options()
        cmd = types.SimpleNamespace(embeddings_dir=str(embeddings), lora_dir=str(loras))
        if host != "Neo":
            cmd.hypernetwork_dir = str(host_root / "models" / "hypernetworks")
        shared = module("modules.shared", opts=opts, cmd_opts=cmd, OptionInfo=OptionInfo, prompt_styles=None)
        sd_models = module("modules.sd_models", model_data=types.SimpleNamespace(get_sd_model=lambda: model))
        callback_functions = {}
        callbacks = module("modules.script_callbacks")
        for name in ["on_app_started", "on_model_loaded", "on_ui_settings", "on_ui_tabs"]:
            setattr(callbacks, name, lambda function, name=name: callback_functions.setdefault(name, function))
        paths = module("modules.paths", extensions_dir=str(host_root / "extensions"), script_path=str(host_root))
        host_scripts = module("modules.scripts", basedir=lambda: str(extension))
        modules = module("modules", shared=shared, sd_models=sd_models, script_callbacks=callbacks,
                         scripts=host_scripts, paths=paths, hashes=types.SimpleNamespace())
        modules.__path__ = []
        if host != "Neo":
            modules.sd_hijack = types.SimpleNamespace(model_hijack=types.SimpleNamespace(embedding_db=database))
        module("modules_forge", __path__=[])
        module("modules_forge.forge_version", version="neo" if host == "Neo" else "original")
        package = module("scripts", __path__=[str(ROOT / "scripts")])
        class MockBlocks:
            def __init__(self, **kwargs):
                self.options = kwargs

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

        module("gradio", Blocks=MockBlocks, HTML=lambda value: value,
               **{name: type(name, (), {}) for name in ["Dropdown", "Textbox", "Code"]})
        module("fastapi", FastAPI=type("FastAPI", (), {}))
        module("fastapi.responses", **{name: type(name, (), {}) for name in ["FileResponse", "JSONResponse", "Response"]})
        module("pydantic", BaseModel=type("BaseModel", (), {}))
        helper = importlib.import_module("scripts.tag_autocomplete_helper")
        helper.on_ui_settings()
        assert opts.tac_gelbooruMode == "Auto"
        assert callback_functions["on_ui_tabs"]()[0][1:] == ("Tag Autocomplete", "tac_dictionary")
        assert helper.get_embed_db() is database
        helper.refresh_embeddings(force=True)
        assert calls == (["neo"] if host == "Neo" else [True])
        assert "sample_embedding" in (extension / "tags/temp/emb.txt").read_text()
        database.word_embeddings = {}
        helper.refresh_embeddings(force=False)
        assert len(calls) == 2
        assert "sample.safetensors" in (extension / "tags/temp/lora.txt").read_text()
        assert (host_root / "tmp/tagAutocompletePath.txt").read_text() == (extension / "tags").as_posix()
        assert set(callback_functions) == {"on_app_started", "on_model_loaded", "on_ui_settings", "on_ui_tabs"}
        # A missing model/database is legitimate before the first model load.
        modules.sd_hijack = None
        helper.sd_hijack = None
        sd_models.model_data.get_sd_model = lambda: types.SimpleNamespace()
        assert helper.get_embed_db() is None
        helper.refresh_embeddings(force=True)
        print("PASS", host, "simulated host: import, settings, paths, LoRA scan, embedding refresh, empty model")


if __name__ == "__main__":
    for name in ["Neo", "Forge", "reForge"]:
        run_host(name)
    print("Backend host smoke checks passed: 3 simulated hosts")
