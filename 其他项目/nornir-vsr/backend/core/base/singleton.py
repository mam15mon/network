"""轻量级单例基类。"""
from threading import RLock


class SingletonBase:
    """线程安全的单例基类。"""

    _instances = {}
    _lock = RLock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls not in cls._instances:
                instance = super().__new__(cls)
                cls._instances[cls] = instance
                instance._initialize(*args, **kwargs)
            return cls._instances[cls]

    def _initialize(self, *args, **kwargs):  # pragma: no cover - 子类实现
        pass
