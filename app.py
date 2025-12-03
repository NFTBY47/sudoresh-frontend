#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import time
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

def is_valid(board, row, col, num):
    # Строка
    for i in range(9):
        if board[row][i] == num:
            return False
    # Столбец
    for i in range(9):
        if board[i][col] == num:
            return False
    # Квадрат 3x3
    box_row = row // 3 * 3
    box_col = col // 3 * 3
    for i in range(3):
        for j in range(3):
            if board[box_row + i][box_col + j] == num:
                return False
    return True

def is_board_valid(board):
    """Проверяет, является ли начальная доска валидной"""
    for row in range(9):
        for col in range(9):
            num = board[row][col]
            if num != 0:
                # Временно убираем число для проверки
                board[row][col] = 0
                if not is_valid(board, row, col, num):
                    return False
                # Возвращаем число обратно
                board[row][col] = num
    return True

def solve_sudoku(board):
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                for num in range(1, 10):
                    if is_valid(board, row, col, num):
                        board[row][col] = num
                        if solve_sudoku(board):
                            return True
                        board[row][col] = 0
                return False
    return True

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if os.path.exists(filename):
        return send_from_directory('.', filename)
    return "File not found", 404

@app.route('/solve', methods=['POST'])
def solve():
    try:
        data = request.get_json()
        board_1d = data.get('board', [])

        if len(board_1d) != 81:
            return jsonify({
                "solved": False,
                "message": "Некорректный размер доски",
                "error": True
            })

        # Преобразуем в 2D
        board = [board_1d[i*9:(i+1)*9] for i in range(9)]
        board_copy = [row[:] for row in board]

        # Сначала проверяем валидность доски
        if not is_board_valid(board_copy):
            return jsonify({
                "solved": False,
                "message": "Некорректное судоку: есть конфликты",
                "error": True
            })

        # Пытаемся решить
        start_time = time.time()
        solved = solve_sudoku(board_copy)
        solve_time = time.time() - start_time

        # Возвращаем в 1D
        solved_board = [num for row in board_copy for num in row]

        return jsonify({
            "solved": solved,
            "board": solved_board if solved else None,
            "message": "Судоку решено" if solved else "Судоку не имеет решения",
            "time": round(solve_time * 1000, 2),  # В миллисекундах
            "server": "python"  # Метаинформация о том, кто решил
        })

    except Exception as e:
        return jsonify({
            "solved": False,
            "message": f"Ошибка сервера: {str(e)}",
            "error": True
        })

@app.route('/check_conflicts', methods=['POST'])
def check_conflicts():
    """API для проверки конфликтов на сервере"""
    try:
        data = request.get_json()
        board_1d = data.get('board', [])
        
        if len(board_1d) != 81:
            return jsonify({"valid": False, "conflicts": []})
        
        # Преобразуем в 2D
        board = [board_1d[i*9:(i+1)*9] for i in range(9)]
        
        conflicts = []
        
        # Проверяем каждую заполненную клетку на конфликты
        for row in range(9):
            for col in range(9):
                num = board[row][col]
                if num != 0:
                    # Временно убираем число
                    board[row][col] = 0
                    
                    # Проверяем строку
                    for i in range(9):
                        if board[row][i] == num:
                            conflict_index = row * 9 + i
                            if conflict_index not in conflicts:
                                conflicts.append(conflict_index)
                    
                    # Проверяем столбец
                    for i in range(9):
                        if board[i][col] == num:
                            conflict_index = i * 9 + col
                            if conflict_index not in conflicts:
                                conflicts.append(conflict_index)
                    
                    # Проверяем блок 3x3
                    box_row = row // 3 * 3
                    box_col = col // 3 * 3
                    for i in range(3):
                        for j in range(3):
                            if board[box_row + i][box_col + j] == num:
                                conflict_index = (box_row + i) * 9 + (box_col + j)
                                if conflict_index not in conflicts:
                                    conflicts.append(conflict_index)
                    
                    # Возвращаем число
                    board[row][col] = num
        
        # Добавляем сами конфликтующие клетки
        for conflict in conflicts[:]:  # Копируем список для итерации
            row = conflict // 9
            col = conflict % 9
            if board[row][col] != 0:
                conflicts.append(conflict)
        
        # Убираем дубликаты
        conflicts = list(set(conflicts))
        
        return jsonify({
            "valid": len(conflicts) == 0,
            "conflicts": conflicts,
            "server": "python"
        })
        
    except Exception as e:
        return jsonify({
            "valid": False,
            "conflicts": [],
            "error": str(e)
        })

@app.route('/health')
def health_check():
    """Эндпоинт для проверки работы сервера"""
    return jsonify({
        "status": "ok",
        "server": "SUDO.RESH Python Backend",
        "timestamp": time.time()
    })

if __name__ == '__main__':
    PORT = 8080  # ← ИЗМЕНЕНИЕ: порт 8080
    print("=" * 50)
    print(f"SUDO.RESH запущен → http://localhost:{PORT}")
    print("=" * 50)
    print("API доступны:")
    print("  GET  /              - интерфейс")
    print("  POST /solve         - решить судоку")
    print("  POST /check_conflicts - проверить конфликты")
    print("  GET  /health        - проверка здоровья сервера")
    print("=" * 50)
    app.run(debug=True, port=PORT, host='0.0.0.0')